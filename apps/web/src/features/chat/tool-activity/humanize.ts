import type { PipelineStep } from "./types";
import { HUMAN_TOOL_LABELS } from "./humanize-labels";

/**
 * Label manusiawi untuk nama tool, diperkaya argumen bila tersedia:
 * "Membaca file" + path → "Membaca package.json".
 */
export function humanizeTool(name: string, args?: string | Record<string, unknown> | null): string {
  const parsed = typeof args === "string" ? safeParseArgs(args) : args ?? undefined;
  const base = labelFor(name);
  const detail = detailFor(name, parsed);
  return detail ? `${base} ${detail}` : base;
}

function safeParseArgs(raw: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function labelFor(name: string): string {
  for (const [re, label] of HUMAN_TOOL_LABELS) {
    if (re.test(name)) return label;
  }
  const n = name.toLowerCase();
  if (n.startsWith("web:")) return "Deep Research";
  if (n.includes("terminal") || n.includes("exec") || n.includes("run_routeros") || n.includes("command")) {
    return "Menjalankan perintah RouterOS";
  }
  if (n.includes("verify") || n.includes("safe_mode_status")) return "Verifikasi Safe Mode";
  if (n.startsWith("docs:")) return "Mencari dokumentasi";
  const short = name.includes(":") ? name.split(":").slice(1).join(":") : name;
  return short.replace(/_/g, " ").slice(0, 48) || name;
}

/** Detail argumen yang membuat label lebih spesifik (path, command, query, script). */
function detailFor(name: string, args?: Record<string, unknown>): string | null {
  if (!args) return null;
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  if (name.startsWith("general:read_file") || name.startsWith("general:write_file") || name.startsWith("general:apply_patch") || name.startsWith("general:replace_text") || name.startsWith("archive:create")) {
    return shortPath(str(args.path) ?? str(args.source));
  }
  if (name.startsWith("general:search_code") || name.startsWith("general:search_files") || name.startsWith("text:search")) {
    return quote(str(args.query) ?? str(args.pattern), 40);
  }
  if (name.startsWith("data:statistics")) return quote(str(args.column), 40);
  if (name.startsWith("data:query_csv") || name.startsWith("data:inspect_csv") || name.startsWith("data:parse_json")) {
    return shortPath(str(args.path));
  }
  if (name.startsWith("project:run_script")) {
    const script = str(args.script);
    return script ? `(${script})` : null;
  }
  if (name.startsWith("general:execute_shell")) {
    const cmd = str(args.command);
    if (!cmd) return null;
    return quote(cmd.split(/\s+/).slice(0, 4).join(" "), 40);
  }
  if (name.startsWith("general:start_process")) return quote(str(args.command)?.split(/\s+/).slice(0, 3).join(" ") ?? null, 40);
  if (name.startsWith("web:fetch_url")) return quote(str(args.url), 40);
  if (name.startsWith("git:")) return shortPath(str(args.path) ?? str(args.ref) ?? str(args.name) ?? null);
  return null;
}

/** Ambil segmen terakhir path (package.json dari src/x/package.json) untuk label singkat. */
function shortPath(path: string | null): string | null {
  if (!path || path === ".") return null;
  const clean = path.replaceAll("\\", "/").replace(/^\.\/+/, "");
  const parts = clean.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  return last ? (parts.length > 1 ? `${parts[parts.length - 2]}/${last}` : last) : null;
}

function quote(value: string | null, max: number): string | null {
  if (!value) return null;
  return `(${value.length > max ? `${value.slice(0, max)}…` : value})`;
}

/** Judul fase kerja yang manusiawi: pemeriksaan baca vs penerapan perubahan. */
export function phaseTitle(steps: PipelineStep[]): string {
  if (steps.length === 0) return "Menyiapkan pemeriksaan";
  if (steps.some((step) => /^(general|drive|gmail|telegram|git|project|data|compute|text|archive|web|system):/.test(step.tool))) {
    return (steps.find((step) => step.status === "running") ?? steps[steps.length - 1]!).label;
  }
  const writeish = /set_|add_|remove_|delete_|update_|enable|disable|create_|apply|reboot|reset/i;
  const mutating = steps.some((s) => writeish.test(s.tool));
  if (mutating) return "Menerapkan perubahan";
  const allDone = steps.every((s) => s.status === "completed");
  if (allDone && steps.length > 1) return "Memeriksa konfigurasi router";
  const current = steps.find((s) => s.status === "running") ?? steps[steps.length - 1]!;
  if (steps.length === 1) return current.label;
  return "Memeriksa konfigurasi router";
}

export function formatDuration(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${Math.round(ms)} mdtk`;
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(ms / 1000)} dtk`;
}

import { createHash } from "node:crypto";
import { redactText } from "../../lib/redaction";
import type { EmitFn } from "./context";

/** Metadata presentasi milik model; tidak diteruskan ke validator/tool eksternal. */
export function splitToolPresentation(value: unknown): { args: unknown; activityLabel?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { args: value };
  const { _activity, ...args } = value as Record<string, unknown>;
  const label = typeof _activity === "string" ? redactText(_activity).replace(/[\r\n\t]+/g, " ").trim().slice(0, 120) : "";
  return { args, ...(label ? { activityLabel: label } : {}) };
}

export function withToolPresentation(emit: EmitFn, activityLabel?: string): EmitFn {
  return async (event) => emit(activityLabel && event.type.startsWith("tool.")
    ? { ...event, payload: { ...event.payload, activityLabel } } : event);
}

export function presentationSchema(schema: Record<string, unknown>): Record<string, unknown> {
  return { ...schema, properties: {
    _activity: { type: "string", maxLength: 120,
      description: "Judul aktivitas singkat Bahasa Indonesia sesuai tujuan nyata langkah ini, misalnya 'Saya sedang menganalisis gambar' atau 'Menyusun landing page Honda'. Tanpa rahasia atau klaim selesai. Isi sebelum content kode agar judul tampil lebih awal." }, ...(schema.properties as Record<string, unknown> ?? {}) } };
}

/** Hanya hasil tulis yang terbukti berhasil boleh menjadi artefak canvas. */
export function writtenCodeArtifact(name: string, args: unknown, result: { ok: boolean; output: string }) {
  if (name !== "general:write_file" || !result.ok || !args || typeof args !== "object") return undefined;
  const { path, content } = args as Record<string, unknown>;
  if (typeof path !== "string" || typeof content !== "string" || content.length > 200_000) return undefined;
  const languages: Record<string, string> = { html: "html", htm: "html", svg: "svg", css: "css", js: "javascript",
    jsx: "jsx", ts: "typescript", tsx: "tsx", json: "json", py: "python", md: "markdown", txt: "text", xml: "xml",
    log: "text", prompt: "text", rst: "text", adoc: "text", csv: "text", ini: "text", env: "text", yaml: "text", yml: "text" };
  const language = languages[path.split(".").at(-1)?.toLowerCase() ?? ""];
  if (!language) return undefined;
  try {
    const saved = JSON.parse(result.output);
    if (saved.path !== path || saved.sha256 !== createHash("sha256").update(content).digest("hex")) return undefined;
    return { path: redactText(path), language, code: redactText(content) };
  } catch { return undefined; }
}

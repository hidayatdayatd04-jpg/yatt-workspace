import { and, desc, eq, like, or } from "drizzle-orm";
import type { Database } from "../../db";
import { agentRuns, attachments, messages, toolExecutions } from "../../db/schema";

const BROWSE_VERBS = ["lihat", "tampilkan", "tunjukkan", "daftar", "daftarkan", "list", "telusuri", "jelajahi", "browse", "tampil", "jelaskan", "cek", "periksa", "cari"];
const BROWSE_NOUNS = ["file", "berkas", "folder", "direktori", "workspace", "isi", "struktur", "arsip", "zip"];
const BROWSE_QUESTION = /\b(apa|apakah|mana)\b/i;

/** Minta eksplorasi eksplisit: kata kerja/browse + kata benda file, atau pertanyaan + kata benda. */
export function hasBrowseIntent(text: string): boolean {
  const t = text.toLowerCase();
  if (!BROWSE_NOUNS.some((w) => t.includes(w))) return false;
  if (BROWSE_VERBS.some((w) => t.includes(w))) return true;
  return BROWSE_QUESTION.test(t);
}

function normalizeRefPath(p: string): string {
  return p.replaceAll("\\", "/").trim().replace(/^\.\//, "").replace(/\/+$/, "").toLowerCase();
}

function baseName(p: string): string {
  return p.split("/").pop() ?? "";
}

/** True bila teks menyebut path lengkap atau nama file berekstensi. */
function mentionsPath(text: string, rawPath: string): boolean {
  const path = normalizeRefPath(rawPath);
  if (!path || path === ".") return false;
  const t = text.toLowerCase();
  if (t.includes(path)) return true;
  const base = baseName(path);
  return base.includes(".") && base.length > 4 && t.includes(base);
}

export interface WorkspaceScope {
  browsingAuthorized: boolean;
}

/** Otorisasi browse percakapan: pernah eksekusi tool file atau ada lampiran siap. */
export async function getWorkspaceScope(db: Database, conversationId: string): Promise<WorkspaceScope> {
  const [execs, atts] = await Promise.all([
    db.select({ id: toolExecutions.id }).from(toolExecutions)
      .innerJoin(agentRuns, eq(toolExecutions.runId, agentRuns.id))
      .where(and(eq(agentRuns.conversationId, conversationId), eq(toolExecutions.status, "completed"),
        or(like(toolExecutions.toolName, "general:%"), like(toolExecutions.toolName, "git:%"), like(toolExecutions.toolName, "archive:%"))))
      .limit(1),
    db.select({ id: attachments.id }).from(attachments)
      .where(and(eq(attachments.conversationId, conversationId), eq(attachments.status, "ready")))
      .limit(1),
  ]);
  return { browsingAuthorized: execs.length > 0 || atts.length > 0 };
}

const TOUCH_TOOLS = ["general:read_file", "general:write_file", "general:import_attachment", "general:extract_zip"];

/** Path yang pernah disentuh run percakapan ini (baca/tulis/impor/ekstrak berhasil). */
async function touchedPaths(db: Database, conversationId: string): Promise<string[]> {
  const rows = await db.select({ tool: toolExecutions.toolName, input: toolExecutions.sanitizedInput })
    .from(toolExecutions)
    .innerJoin(agentRuns, eq(toolExecutions.runId, agentRuns.id))
    .where(and(eq(agentRuns.conversationId, conversationId), eq(toolExecutions.status, "completed")));
  const out: string[] = [];
  for (const row of rows) {
    if (!TOUCH_TOOLS.includes(row.tool)) continue;
    let args: Record<string, unknown> = {};
    try {
      args = typeof row.input === "string" ? (JSON.parse(row.input) as Record<string, unknown>) : ((row.input as Record<string, unknown> | null) ?? {});
    } catch {
      continue;
    }
    const vals = [args.path, args.destination, ...(Array.isArray(args.entries) ? args.entries : [])];
    for (const v of vals) {
      if (typeof v !== "string") continue;
      const n = normalizeRefPath(v);
      if (n && n !== ".") out.push(n);
    }
  }
  return out;
}

/** Baca/ekstrak diizinkan bila path dirujuk teks saat ini, riwayat user, atau pernah disentuh; atau browse sudah diotorisasi. */
export async function isWorkspacePathAllowed(db: Database, conversationId: string, currentText: string, rawPath: string): Promise<boolean> {
  const path = normalizeRefPath(rawPath);
  if (!path || path === ".") return true;
  if (mentionsPath(currentText, path)) return true;
  const hist = await db.select({ content: messages.content }).from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.role, "user")))
    .orderBy(desc(messages.seq)).limit(8);
  for (const row of hist) {
    const text = (row.content as { text?: unknown } | null)?.text;
    if (typeof text === "string" && mentionsPath(text, path)) return true;
  }
  const touched = await touchedPaths(db, conversationId);
  if (touched.some((t) => t === path || baseName(t) === baseName(path))) return true;
  return (await getWorkspaceScope(db, conversationId)).browsingAuthorized;
}

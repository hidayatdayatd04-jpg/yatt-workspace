import { toolExecutions } from "../../db/schema";
import { redactObject } from "../../lib/redaction";
import type { ChatToolCall } from "../chat-client";
import type { EmitFn, ToolMsg } from "./context";
import { isWorkspacePathAllowed } from "./workspace-scope";
import type { StartRunInput } from "./types";
import type { Database } from "../../db";

/**
 * Kunci anti-intip: baca/ekstrak path yang tak dirujuk percakapan ini ditolak
 * sebelum pemeriksaan lain — file chat lain tidak boleh dibuka diam-diam.
 */
export async function rejectUnreferencedPath(
  db: Database,
  input: StartRunInput,
  call: ChatToolCall,
  fqName: string,
  args: unknown,
  emit: EmitFn,
  started: number,
): Promise<DispatchOutcomeDenied | null> {
  if ((fqName !== "general:read_file" && fqName !== "general:extract_zip") || typeof (args as { path?: unknown } | null)?.path !== "string") {
    return null;
  }
  const ref = (args as { path: string }).path;
  if (await isWorkspacePathAllowed(db, input.conversationId, input.userText, ref)) return null;
  const code = "UNREFERENCED_PATH";
  const message = `File "${ref}" tidak disebut di percakapan ini.`;
  const guidance = "JANGAN menebak atau membuka file lain. Tanyakan kepada pengguna file mana yang dimaksud (atau minta diunggah sebagai lampiran), lalu ulangi dengan path tersebut.";
  await db.insert(toolExecutions).values({ runId: input.runId, toolCallId: call.id, toolName: fqName, risk: "unknown", sanitizedInput: redactObject(args ?? {}), resultSummary: null, status: "denied", errorCode: code, durationMs: Date.now() - started }).onConflictDoNothing();
  await emit({ type: "tool.failed", payload: { callId: call.id, name: fqName, code, message, durationMs: Date.now() - started } });
  return {
    allowed: false,
    toolMsg: { role: "tool", content: JSON.stringify({ ok: false, error: code, message, guidance }), toolCallId: call.id, note: `Tool ${fqName} ditolak (${code}): ${message}`.slice(0, 500), ok: false, errorCode: code, risk: "unknown" },
  };
}

export interface DispatchOutcomeDenied { allowed: false; toolMsg: ToolMsg }

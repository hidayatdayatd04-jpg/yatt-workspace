import type { StreamEvent } from "./types";
import { redactText } from "../../lib/redaction";

/** Publikasikan metadata saja; argumen parsial tidak pernah dieksekusi/dikirim ke UI. */
export function createToolProgressReader() {
  const seen = new Map<string, string>();
  return (call: { id: string; name: string; args: string }): StreamEvent | null => {
    if (!call.id || !call.name) return null;
    const match = /(?<!\\)"_activity"\s*:\s*("(?:[^"\\]|\\.)*")/.exec(call.args);
    let activityLabel = "";
    try { if (match) activityLabel = redactText(JSON.parse(match[1]!)).replace(/[\r\n\t]/g, " ").slice(0, 120); }
    catch { /* label lengkap menyusul pada chunk berikutnya */ }
    if (seen.get(call.id) === activityLabel) return null;
    seen.set(call.id, activityLabel);
    return { type: "tool_progress", toolProgress: { id: call.id, name: call.name, activityLabel } };
  };
}

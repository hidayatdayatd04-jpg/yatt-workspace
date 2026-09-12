import type { ChatToolCall, StreamEvent } from "../chat-client";
import type { NormalizedTool } from "../../policies/normalize";
import type { EmitFn } from "./context";

/** Waktu persiapan diukur dari stream provider, terpisah dari eksekusi disk. */
export function createToolProgressPublisher(catalog: NormalizedTool[], emit: EmitFn) {
  const started = new Map<string, number>();
  return {
    async update(progress: NonNullable<StreamEvent["toolProgress"]>) {
      const tool = catalog.find((t) => t.fqName.replace(/[^A-Za-z0-9_-]/g, "_") === progress.name);
      if (!tool) return;
      if (!started.has(progress.id)) started.set(progress.id, Date.now());
      await emit({ type: "tool.preparing", payload: { callId: progress.id, name: tool.fqName,
        ...(progress.activityLabel ? { activityLabel: progress.activityLabel } : {}) } });
    },
    complete(call: ChatToolCall): ChatToolCall {
      const at = started.get(call.id);
      return at === undefined ? call : { ...call, preparationMs: Math.max(0, Date.now() - at) };
    },
  };
}

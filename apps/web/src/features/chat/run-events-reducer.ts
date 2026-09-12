import type { RunEventDTO } from "./chat-hooks";
import type { LiveToolItem, RunEventsSink } from "./run-event-types";
import { activityMetadata } from "./tool-activity/metadata";

/** Parse payload SSE; null bila bukan JSON event run yang valid. */
export function parsePayload(type: RunEventDTO["type"], data: string): RunEventDTO | null {
  try {
    return { ...JSON.parse(data), type } as RunEventDTO;
  } catch {
    return null;
  }
}

/** Tolak replay/duplikat dan event run lain; seq pecahan display tak pernah sampai sini. */
export function isFreshEvent(ev: RunEventDTO, runId: string, lastSeq: number): boolean {
  return ev.runId === runId && Number.isInteger(ev.seq) && ev.seq > lastSeq;
}

/** Terapkan satu event rilis ke state (dipanggil berurutan per tick). */
export function applyRunEvent(sink: RunEventsSink, ev: RunEventDTO): void {
  const { setStreamText, setReasoningText, setToolActivity, setTxStatus, setQueueStatus } = sink;
  if (ev.type === "reasoning.delta") {
    const chunk = String((ev.payload as { text?: string }).text ?? "");
    setReasoningText((prev) => prev + chunk);
  } else if (ev.type === "message.delta") {
    setQueueStatus(null);
    const chunk = String((ev.payload as { text?: string }).text ?? "");
    setStreamText((prev) => prev + chunk);
  } else if (ev.type === "provider.waiting") {
    const p = ev.payload as { waitedMs?: number };
    const secs = Math.max(1, Math.round(Number(p.waitedMs ?? 0) / 1000));
    setQueueStatus(`Menunggu giliran provider · antre ${secs} dtk`);
  } else if ((ev.type === "tool.preparing" || ev.type === "tool.started")) {
    setQueueStatus(null);
    const p = ev.payload as { name?: string; callId?: string; args?: string };
    const name = String(p.name ?? "tool");
    if (name === "web:search") return; // Deep Research — kartu sendiri via liveEvents
    const id = String(p.callId ?? `${name}-${ev.seq}`);
    setToolActivity((prev) => (prev.some((t) => t.id === id) ? prev : [...prev, { id, name, status: "running", args: typeof p.args === "string" ? p.args : undefined, ...activityMetadata(ev.payload) }]));
  } else if (ev.type === "transaction.updated") {
    const p = ev.payload as { state?: string; actions?: number };
    // Distinguish settling phase: commit/rollback in-flight vs terminal.
    const settling = ["preparing", "active", "verifying", "committing", "rolling_back"].includes(String(p.state ?? ""));
    setTxStatus(settling ? `Menyelesaikan transaksi · ${p.state} · aksi ${p.actions ?? 0}` : `Safe Mode ${p.state ?? "?"} · aksi ${p.actions ?? 0}`);
  } else if (ev.type === "tool.completed") {
    const p = ev.payload as { callId?: string; name?: string; args?: string };
    if (String(p.name ?? "") === "web:search") return; // Deep Research
    const id = p.callId ? String(p.callId) : null;
    setToolActivity((prev) => {
      const next = [...prev];
      const enrich = (t: LiveToolItem): LiveToolItem => ({ ...t, ...activityMetadata(ev.payload), status: "done", args: t.args ?? (typeof p.args === "string" ? p.args : undefined) });
      if (id) {
        const idx = next.findIndex((t) => t.id === id);
        if (idx >= 0) {
          next[idx] = enrich(next[idx]!);
          return next;
        }
      }
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i]!.status === "running") {
          next[i] = enrich(next[i]!);
          break;
        }
      }
      return next;
    });
  } else if (ev.type === "tool.failed") {
    const p = ev.payload as { callId?: string; name?: string; args?: string };
    if (String(p.name ?? "") === "web:search") return; // Deep Research
    const id = p.callId ? String(p.callId) : null;
    setToolActivity((prev) => {
      const next = [...prev];
      const enrich = (t: LiveToolItem): LiveToolItem => ({ ...t, ...activityMetadata(ev.payload), status: "failed", args: t.args ?? (typeof p.args === "string" ? p.args : undefined) });
      if (id) {
        const idx = next.findIndex((t) => t.id === id);
        if (idx >= 0) {
          next[idx] = enrich(next[idx]!);
          return next;
        }
      }
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i]!.status === "running") {
          next[i] = { ...next[i]!, status: "failed" };
          break;
        }
      }
      return next;
    });
  }
}

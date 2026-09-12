import { useEffect } from "react";
import { STREAM_EVENT_TYPES } from "./run-event-types";
import { TERMINAL } from "./run-event-types";
import type { RunEventDTO } from "./chat-hooks";

/** Listener status terminal transport (tanpa nama event) + sinyal done server. */
function attachTerminalListeners(
  es: EventSource,
  runId: string,
  notifyTerminal: (cancelled: boolean, runId: string) => void,
  isDone: () => boolean,
  onDoneEvent: () => void,
) {
  es.onmessage = (e) => {
    if (!e.data || isDone()) return;
    try {
      const parsed = JSON.parse(e.data) as { status?: string };
      if (parsed.status && (TERMINAL as readonly string[]).includes(parsed.status)) {
        notifyTerminal(parsed.status === "cancelled", runId);
      }
    } catch {
      /* abaikan keepalive non-JSON */
    }
  };

  // Server hanya mengirim `done` untuk run terminal.
  es.addEventListener("done", () => {
    if (isDone()) return;
    notifyTerminal(false, runId);
    onDoneEvent();
  });
}

/** Pipa SSE murni: sambung, teruskan event ke handler, reconnect saat putus. */
export function useRunEventStream(
  runId: string | null,
  handlePayload: (type: RunEventDTO["type"], data: string) => void,
  notifyTerminal: (cancelled: boolean, runId: string) => void,
  lastSeqRef: { current: number },
) {
  useEffect(() => {
    if (!runId) return;
    const id = runId;
    let cancelled = false;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let done = false;

    const teardown = () => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      try {
        es?.close();
      } catch {
        /* abaikan */
      }
      es = null;
    };

    const markDone = () => {
      done = true;
      teardown();
    };

    const connect = () => {
      if (cancelled || done) return;
      try {
        es?.close();
      } catch {
        /* abaikan */
      }
      const from = lastSeqRef.current;
      es = new EventSource(`/api/runs/${id}/events${from > 0 ? `?from=${from}` : ""}`);
      attachTerminalListeners(es, id, notifyTerminal, () => done || cancelled, markDone);

      for (const type of STREAM_EVENT_TYPES) {
        es.addEventListener(type, (e: MessageEvent) => {
          if (!done) handlePayload(type, (e as MessageEvent).data);
        });
      }
      // Terminal via antrean juga menutup stream lokal.
      es.addEventListener("run.completed", markDone);
      es.addEventListener("run.cancelled", markDone);
      es.addEventListener("run.failed", markDone);

      es.onerror = () => {
        if (cancelled || done || !es) return;
        // Gagal transport BUKAN sinyal terminal: reconnect eksplisit.
        if (es.readyState === 2) {
          try {
            es.close();
          } catch {
            /* abaikan */
          }
          es = null;
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [runId, handlePayload, notifyTerminal, lastSeqRef]);
}

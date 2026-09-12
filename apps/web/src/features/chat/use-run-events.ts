import { useCallback, useEffect, useRef, useState } from "react";
import type { RunEventDTO } from "./chat-hooks";
import type { LiveRunError, LiveToolItem, RunEventsSink } from "./run-event-types";
import { applyRunEvent, isFreshEvent, parsePayload } from "./run-events-reducer";
import { appendReleasedEvents, createPacedQueue, CODE_TYPEWRITER_INTERVAL_MS, type PacedQueue, type TerminalInfo } from "./run-events-buffer";
import { useRunEventStream } from "./run-events-stream";
import { useRunEventsPoll } from "./run-events-poll";
import { toRunErrorInfo } from "./run-error";

/**
 * Live SSE subscription untuk satu run. Rilis event BERURUTAN dan BERPACING
 * lewat antrean: teks mengetik dulu sampai habis, baru kartu tool — dari
 * atas ke bawah. Kecepatan huruf tetap sama sampai akhir run.
 */
export function useRunEvents(runId: string | null, onDone?: () => void) {
  const [events, setEvents] = useState<RunEventDTO[]>([]);
  const [live, setLive] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [reasoningText, setReasoningText] = useState("");
  const [toolActivity, setToolActivity] = useState<LiveToolItem[]>([]);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState<string | null>(null);
  const [runError, setRunError] = useState<LiveRunError | null>(null);
  const doneRef = useRef(onDone);
  const finishRef = useRef<(immediate?: boolean) => void>(() => {});
  const lastSeqRef = useRef(0);
  const runIdRef = useRef(runId);
  const servedRunRef = useRef<string | null>(null);
  const finishedRef = useRef(false);
  doneRef.current = onDone;
  runIdRef.current = runId;

  const queueRef = useRef<PacedQueue | null>(null);
  if (!queueRef.current) {
    queueRef.current = createPacedQueue({
      onRelease(units) {
        setEvents((prev) => appendReleasedEvents(prev, units));
        const sink: RunEventsSink = { setEvents, setStreamText, setReasoningText, setToolActivity, setTxStatus, setQueueStatus, setLive, setRunError };
        for (const ev of units) applyRunEvent(sink, ev);
      },
      onTerminal(info: TerminalInfo) {
        if (info.failed) setRunError({ runId: info.runId, ...info.failed });
        confirmLiveDone();
      },
    });
  }

  const confirmLiveDone = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setLive(false);
    doneRef.current?.();
  }, []);

  useEffect(() => {
    // StrictMode dev me-remount efek untuk run yang sama: jangan reset.
    if (runId !== null && servedRunRef.current === runId) return;
    servedRunRef.current = runId;
    finishedRef.current = false;
    queueRef.current?.clear();
    lastSeqRef.current = 0;
    setEvents([]);
    setStreamText("");
    setReasoningText("");
    setToolActivity([]);
    setTxStatus(null);
    setQueueStatus(null);
    setRunError(null);
    setLive(!!runId);
    // Poller hanya memastikan marker terminal (atau batal seketika);
    // konfirmasi selesai tetap lewat antrean agar tak ada lompatan.
    finishRef.current = (immediate?: boolean) => {
      const q = queueRef.current;
      if (!q || !runId) return;
      if (immediate) q.cancelNow(runId);
      else q.ensureTerminal(runId);
    };
    if (!runId) finishRef.current = () => {};
  }, [runId, confirmLiveDone]);

  useEffect(() => {
    if (!runId) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const id = setInterval(() => {
      if (motion.matches) queueRef.current?.flushAll();
      else queueRef.current?.tick(performance.now());
    }, CODE_TYPEWRITER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [runId]);

  const handlePayload = useCallback((type: RunEventDTO["type"], data: string) => {
    const id = runIdRef.current;
    if (!id || finishedRef.current) return;
    const ev = parsePayload(type, data);
    if (!ev || !isFreshEvent(ev, id, lastSeqRef.current)) return;
    lastSeqRef.current = ev.seq;
    const queue = queueRef.current;
    if (!queue) return;
    if (ev.type === "reasoning.delta" || ev.type === "message.delta") {
      queue.pushText(ev);
    } else if (ev.type === "run.cancelled") {
      queue.pushTerminal({ cancelled: true, runId: id });
      queue.flushAll();
    } else if (ev.type === "run.completed" || ev.type === "run.failed") {
      // Detail kegagalan ditangkap terstruktur untuk kartu error (bukan chat).
      const failed = ev.type === "run.failed"
        ? toRunErrorInfo(ev.payload as { code?: unknown; reason?: unknown; message?: unknown; toolSucceeded?: unknown; toolFailed?: unknown })
        : undefined;
      queue.pushTerminal({ cancelled: false, runId: id, failed });
    } else {
      queue.pushEvent(ev);
    }
  }, []);

  const notifyTerminal = useCallback((cancelled: boolean, runId: string) => {
    if (!runId || finishedRef.current) return;
    queueRef.current?.pushTerminal({ cancelled, runId });
    if (cancelled) queueRef.current?.flushAll();
  }, []);

  useRunEventStream(runId, handlePayload, notifyTerminal, lastSeqRef);
  useRunEventsPoll(runId, finishRef);

  return { events, streamText, reasoningText, toolActivity, txStatus, queueStatus, live, runError };
}

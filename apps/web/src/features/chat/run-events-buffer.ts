import { artifactTypingEvent } from "./artifact-events";
import type { RunEventDTO } from "./chat-hooks";
import type { LiveRunError } from "./run-event-types";

export interface TerminalInfo {
  cancelled: boolean;
  runId: string;
  failed?: Omit<LiveRunError, "runId">;
}

type QueueItem = { ev: RunEventDTO; chars?: string[]; offset: number; span?: number; perTick?: number };
const TYPEWRITER_INTERVAL_MS = 18;
export const CODE_TYPEWRITER_INTERVAL_MS = 4;
/** Artefak sebesar apa pun selesai diketik maksimal ~500 tick (≈2 dtk). */
const MAX_ARTIFACT_TYPE_TICKS = 500;

export interface PacedQueue {
  pushText(ev: RunEventDTO): void;
  pushEvent(ev: RunEventDTO): void;
  pushTerminal(info: TerminalInfo): void;
  ensureTerminal(runId: string): void;
  cancelNow(runId: string): void;
  tick(now?: number): void;
  flushAll(): void;
  clear(): void;
}

/** Teks 1 huruf per tick; artefak besar pakai budget adaptif agar selalu selesai cepat. */
export function createPacedQueue(cbs: {
  onRelease(units: RunEventDTO[]): void;
  onTerminal(info: TerminalInfo): void;
}): PacedQueue {
  let items: QueueItem[] = [];
  let terminal: TerminalInfo | null = null;
  let finished = false;
  let lastTick: number | undefined;

  function drain(budget: number) {
    const out: RunEventDTO[] = [];
    while (items.length) {
      const item = items[0]!;
      if (item.chars) {
        if (budget <= 0) break;
        // Flush (budget Infinity) melepas sisa sekaligus; pacing biasa dibatasi perTick.
        const cap = budget === Infinity ? item.chars.length - item.offset : (item.perTick ?? 1);
        const step = Math.min(cap, item.chars.length - item.offset);
        out.push({ ...item.ev, seq: item.ev.seq + item.offset * (item.span ?? 1) / (item.chars.length + 1),
          payload: { ...item.ev.payload, text: item.chars.slice(item.offset, item.offset + step).join("") } });
        item.offset += step;
        budget -= 1;
        if (item.offset < item.chars.length) break;
      } else out.push(item.ev);
      items.shift();
    }
    if (out.length) cbs.onRelease(out);
    if (!items.length && terminal && !finished) {
      finished = true;
      cbs.onTerminal(terminal);
    }
  }

  function pushTerminal(info: TerminalInfo) {
    if (finished) return;
    terminal = { ...terminal, ...info, failed: info.failed ?? terminal?.failed };
    drain(0);
  }

  return {
    pushText(ev) {
      if (finished) return;
      const chars = Array.from(String(ev.payload.text ?? ""));
      if (chars.length) items.push({ ev, chars, offset: 0 });
      else if (ev.payload.segmentStart || ev.payload.segmentEnd) {
        items.push({ ev, offset: 0 });
        drain(0);
      }
    },
    pushEvent(ev) {
      if (finished) return;
      const draft = artifactTypingEvent(ev);
      if (draft) {
        const chars = Array.from(String(draft.payload.text));
        // Artefak besar diketik lebih dari satu huruf per tick agar seluruh
        // kode selesai ≤ MAX_ARTIFACT_TYPE_TICKS tick — kartu tool tidak menggantung.
        const perTick = Math.max(1, Math.ceil(chars.length / MAX_ARTIFACT_TYPE_TICKS));
        items.push({ ev: draft, chars, offset: 0, span: 0.5, perTick });
      }
      items.push({ ev, offset: 0 });
      drain(0);
    },
    pushTerminal,
    ensureTerminal(runId) { pushTerminal({ cancelled: false, runId }); },
    cancelNow(runId) {
      pushTerminal({ cancelled: true, runId });
      drain(Infinity);
    },
    tick(now) {
      const interval = items[0]?.ev.type === "artifact.delta" ? CODE_TYPEWRITER_INTERVAL_MS : TYPEWRITER_INTERVAL_MS;
      if (now !== undefined && lastTick !== undefined && now - lastTick < interval) return;
      lastTick = now;
      drain(1);
    },
    flushAll() { drain(Infinity); },
    clear() { items = []; terminal = null; finished = false; lastTick = undefined; },
  };
}

/** Gabungkan fragmen display agar timeline tidak bertambah satu objek per huruf. */
export function appendReleasedEvents(previous: RunEventDTO[], units: RunEventDTO[]): RunEventDTO[] {
  const next = [...previous];
  for (const ev of units) {
    const last = next.at(-1);
    if (last && last.type === ev.type && last.runId === ev.runId && Math.floor(last.seq) === Math.floor(ev.seq)
      && (ev.type === "artifact.delta" || ev.type === "message.delta" || ev.type === "reasoning.delta")) {
      next[next.length - 1] = { ...last, payload: { ...last.payload, text: String(last.payload.text ?? "") + String(ev.payload.text ?? "") } };
    } else next.push(ev);
  }
  return next;
}

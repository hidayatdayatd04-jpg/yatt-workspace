import { createCustomThinkingParser, type ThinkingPart } from "./custom-thinking";
import type { EmitFn, RunCounters } from "./context";

/** Batas keras satu segmen penalaran — cegah loop non-identik yang panjang. */
const REASONING_SEGMENT_CAP = 12_000;
/** Delta dinilai berulang bila (hampir) sama dengan yang baru tercetak. */
const REPEAT_MIN_CHARS = 40;
const REPEAT_HITS_LIMIT = 3;
/** Jendela teks ternormalisasi terakhir yang dipakai mendeteksi pengulangan. */
const TAIL_WINDOW = 600;
/** Ukuran potongan saat buffer native diflush — kecil agar guard repeksi. */
const NATIVE_FLUSH_CHUNK = 400;/** Akumulasi teks bersih dan segmen reasoning, sama untuk native dan custom. */
export function createStreamText(customThinking: boolean, c: RunCounters, emitSeq: EmitFn) {
  const parser = customThinking ? createCustomThinkingParser() : null;
  let stepText = "";
  let startedAt: number | null = null;
  // Gate mode custom: penalaran native dibuffer (bukan blok live) dan hanya
  // dipakai sebagai fallback bila model tidak memakai [[PIKIR]] sama sekali.
  let nativeBuffer = "";
  let sawPikir = false;
  // Guard anti-berputar untuk channel penalaran (lihat DISIPLIN ANTI-BERPUTAR).
  let segmentChars = 0;
  let tail = "";
  let repeatHits = 0;
  let suppressed = false;

  function resetSegmentGuard() {
    segmentChars = 0;
    tail = "";
    repeatHits = 0;
    suppressed = false;
  }

  /** Deteksi pengulangan: potongan ≥40 kar. ternormalisasi terkandung di tail. */
  function isRepetition(text: string): boolean {
    const norm = text.toLowerCase().replace(/\s+/g, " ").trim();
    if (norm.length < REPEAT_MIN_CHARS) return false;
    if (tail && tail.includes(norm)) {
      repeatHits += 1;
      return true;
    }
    repeatHits = 0;
    tail = `${tail} ${norm}`.slice(-TAIL_WINDOW);
    return false;
  }

  async function endReasoning() {
    if (startedAt === null) return;
    const durationMs = Math.max(0, Date.now() - startedAt);
    startedAt = null;
    await emitSeq({ type: "reasoning.delta", payload: { text: "", segmentEnd: true, durationMs } });
  }

  async function reasoning(text: string, segmentStart = false) {
    if (segmentStart) {
      await endReasoning();
      resetSegmentGuard();
    }
    if (suppressed) return;
    if (startedAt === null) {
      resetSegmentGuard();
      startedAt = Date.now();
      c.reasoningText += "\n\n";
      await emitSeq({ type: "reasoning.delta", payload: { text: "", segmentStart: true } });
    }
    // Reasoning native bisa memuat literal marker [[PIKIR]] — buang agar tidak
    // bocor ke UI (channel reasoning tidak melewati parser custom).
    const clean = text.replace(/\[\[\/?PIKIR\]\]/g, "");
    if (!clean) return;
    const repeats = isRepetition(clean);
    segmentChars += clean.length;
    if (repeatHits >= REPEAT_HITS_LIMIT || segmentChars > REASONING_SEGMENT_CAP) {
      // Tutup segmen bermasalah lebih awal; delta berikutnya dibuang sampai
      // titik keputusan baru (segmen/tool baru) — channel jawaban tak tersentuh.
      suppressed = true;
      const note = repeats
        ? "[Perulangan terdeteksi — penalaran dihentikan otomatis]"
        : "[Batas panjang penalaran tercapai]";
      c.reasoningText += ` ${note}`;
      await emitSeq({ type: "reasoning.delta", payload: { text: ` ${note}` } });
      await endReasoning();
      return;
    }
    c.reasoningText += clean;
    await emitSeq({ type: "reasoning.delta", payload: { text: clean } });
  }

  /** Buffer penalaran native (hanya mode custom) — dibatasi cap segmen. */
  function nativeReasoning(text: string) {
    if (!parser || !text) return;
    const room = REASONING_SEGMENT_CAP - nativeBuffer.length;
    if (room > 0) nativeBuffer += text.slice(0, room);
  }

  /**
   * Fallback: bila sejauh ini TIDAK ada blok [[PIKIR]], jadikan buffer native
   * SATU segmen penalaran (dipotong per-chunk agar guard repeksi tetap jalan).
   * Bila [[PIKIR]] sudah muncul, buang buffer — blok custom menang.
   */
  async function flushNative() {
    const text = nativeBuffer.replace(/\[\[\/?PIKIR\]\]/g, "");
    nativeBuffer = "";
    const discard = sawPikir;
    sawPikir = false;
    if (!parser || discard || !text.trim()) return;
    for (let i = 0; i < text.length && !suppressed; i += NATIVE_FLUSH_CHUNK) {
      await reasoning(text.slice(i, i + NATIVE_FLUSH_CHUNK));
    }
  }

  async function answer(text: string) {
    if (!text) return;
    // Jawaban pertama = model sudah meninggalkan protokol [[PIKIR]]: flush
    // native sebagai segmen SEBELUM jawaban agar urutan timeline benar.
    if (parser && nativeBuffer) await flushNative();
    await endReasoning();
    if (!stepText && c.assistantText) {
      c.assistantText += "\n\n";
      await emitSeq({ type: "message.delta", payload: { text: "\n\n" } });
    }
    stepText += text;
    c.assistantText += text;
    await emitSeq({ type: "message.delta", payload: { text } });
  }

  async function publish(parts: ThinkingPart[]) {
    for (const part of parts) {
      if (part.type === "answer") await answer(part.text);
      else if (part.segmentEnd) await endReasoning();
      else {
        sawPikir = true;
        await reasoning(part.text, part.segmentStart);
      }
    }
  }

  async function finish() {
    if (parser) await publish(parser.finish());
    await flushNative();
    resetSegmentGuard();
    await endReasoning();
  }

  return {
    reasoning, finish, nativeReasoning,
    text: (text: string) => parser ? publish(parser.feed(text)) : answer(text),
    get stepText() { return stepText; },
  };
}

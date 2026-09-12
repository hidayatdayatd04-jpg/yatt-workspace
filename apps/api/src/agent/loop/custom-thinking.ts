import { THINKING_CLOSE, THINKING_OPEN } from "../instructions-thinking";

export interface ThinkingPart {
  type: "reasoning" | "answer";
  text: string;
  segmentStart?: boolean;
  segmentEnd?: boolean;
}

/** Mengembalikan bagian berurutan: satu delta dapat memuat banyak blok. */
export function createCustomThinkingParser() {
  let buffer = "";
  let thinking = false;
  const markers = [THINKING_OPEN, THINKING_CLOSE];
  const content = (text: string): ThinkingPart => ({ type: thinking ? "reasoning" : "answer", text });

  function feed(text: string): ThinkingPart[] {
    buffer += text;
    const parts: ThinkingPart[] = [];
    while (buffer) {
      const found = markers.map((marker) => ({ marker, index: buffer.indexOf(marker) }))
        .filter((item) => item.index >= 0).sort((a, b) => a.index - b.index)[0];
      if (found) {
        if (found.index) parts.push(content(buffer.slice(0, found.index)));
        buffer = buffer.slice(found.index + found.marker.length);
        if (found.marker === THINKING_OPEN) {
          if (thinking) parts.push({ type: "reasoning", text: "", segmentEnd: true });
          thinking = true;
          parts.push({ type: "reasoning", text: "", segmentStart: true });
        } else if (thinking) {
          parts.push({ type: "reasoning", text: "", segmentEnd: true });
          thinking = false;
        }
        continue;
      }
      // Tahan hanya suffix yang masih mungkin menjadi marker pada delta berikutnya.
      let held = 0;
      for (const marker of markers) {
        for (let size = 1; size < marker.length && size <= buffer.length; size++) {
          if (buffer.endsWith(marker.slice(0, size))) held = Math.max(held, size);
        }
      }
      const ready = buffer.slice(0, buffer.length - held);
      if (ready) parts.push(content(ready));
      buffer = buffer.slice(buffer.length - held);
      break;
    }
    return parts;
  }

  function finish(): ThinkingPart[] {
    // Prefix protokol yang terputus tidak boleh bocor; bracket biasa tetap teks.
    const parts = buffer && !buffer.startsWith("[[") ? [content(buffer)] : [];
    if (thinking) parts.push({ type: "reasoning", text: "", segmentEnd: true });
    buffer = "";
    thinking = false;
    return parts;
  }

  return { feed, finish };
}

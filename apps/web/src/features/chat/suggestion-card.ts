/**
 * Blok saran lanjutan ringan (`````suggestions`````): model boleh menutup
 * jawaban final dengan 2-3 pertanyaan lanjutan yang relevan. Dirender
 * sebagai chip di bawah pesan — mengikuti pola blok ```approval/```ask
 * yang sudah ada, tanpa mengubah skema keduanya.
 *
 * Format:
 * ```suggestions
 * ["Cek status interface?", "Lihat log error?"]
 * ```
 * atau {"suggestions": [...]}. Maks 3 saran, tiap saran 4-80 karakter.
 */

const FENCE_RE = /```suggestions\s*\n([\s\S]*?)\n?```/g;

function normalize(value: unknown): string[] | null {
  let arr: unknown = value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    arr = (value as { suggestions?: unknown }).suggestions;
  }
  if (!Array.isArray(arr)) return null;
  const out = arr
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && s.length <= 80)
    .slice(0, 3);
  return out.length > 0 ? out : null;
}

export function extractSuggestions(text: string): string[] | null {
  FENCE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FENCE_RE.exec(text)) !== null) {
    try {
      const parsed: unknown = JSON.parse(m[1] ?? "");
      const items = normalize(parsed);
      if (items) return items;
    } catch {
      /* abaikan blok rusak */
    }
  }
  return null;
}

export function stripSuggestions(text: string): string {
  FENCE_RE.lastIndex = 0;
  return text
    .replace(FENCE_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

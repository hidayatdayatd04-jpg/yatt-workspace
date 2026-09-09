const KEY = "prompt-recent-v1";
const MAX = 8;

export function loadRecentPrompts(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, MAX);
  } catch {
    return [];
  }
}

export function saveRecentPrompt(text: string): void {
  const trimmed = text.trim().slice(0, 500);
  if (trimmed.length < 4) return;
  try {
    const prev = loadRecentPrompts().filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
    localStorage.setItem(KEY, JSON.stringify([trimmed, ...prev].slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

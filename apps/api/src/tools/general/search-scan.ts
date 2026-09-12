import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const PREVIEW_CHARS = 240;

/** Ekstensi yang hampir pasti bukan teks untuk dibaca baris demi baris. */
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|bmp|pdf|zip|7z|rar|gz|tgz|tar|xz|docx?|xlsx?|pptx?|exe|dll|so|dylib|bin|wasm|mp3|mp4|mov|avi|sqlite|db|ros-help)$/i;
export const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".venv", "venv", "__pycache__", ".cache", "target", "coverage", ".bun"]);

/** Rekursi terbatas: kumpulkan file teks kandidat di bawah root workspace. */
async function walkTextFiles(root: string, dir: string, out: string[], limit: number, maxDepth: number, depth: number): Promise<void> {
  if (out.length >= limit || depth > maxDepth) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (out.length >= limit) return;
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walkTextFiles(root, full, out, limit, maxDepth, depth + 1);
    } else if (entry.isFile() && !BINARY_EXT.test(entry.name) && !entry.name.startsWith(".git")) {
      try {
        if ((await lstat(full)).size > 2_000_000) continue;
        out.push(full);
      } catch {
        /* file hilang di tengah walk — abaikan */
      }
    }
  }
}

export interface CodeMatch {
  path: string;
  line: number;
  column: number;
  preview: string;
}

/** Cari baris yang memuat query (literal, opsional regex) — hasil terstruktur. */
export async function searchInFiles(root: string, args: { query: string; regex: boolean; caseSensitive: boolean; filePattern?: string; maxResults: number; offset: number }): Promise<{ matches: CodeMatch[]; totalMatches: number; nextOffset: number | null; filesScanned: number }> {
  const pool: string[] = [];
  await walkTextFiles(root, root, pool, 2000, 10, 0);
  const pattern = args.filePattern ? new RegExp(args.filePattern, "i") : null;
  const needle = args.caseSensitive ? args.query : args.query.toLowerCase();
  const matches: CodeMatch[] = [];
  let total = 0;
  let filesScanned = 0;
  for (const file of pool) {
    if (pattern && !pattern.test(file.slice(root.length + 1))) continue;
    filesScanned++;
    const text = await readFile(file, "utf8").catch(() => null);
    if (text === null) continue;
    for (const [i, line] of text.split("\n").entries()) {
      const hay = args.caseSensitive ? line : line.toLowerCase();
      let col = args.regex ? hay.search(args.query) : hay.indexOf(needle);
      if (col < 0) continue;
      total++;
      if (total > args.offset && matches.length < args.maxResults) {
        matches.push({ path: file.slice(root.length + 1).replaceAll("\\", "/"), line: i + 1, column: col + 1, preview: line.trim().slice(0, PREVIEW_CHARS) });
      }
      if (!args.regex) {
        // temukan semua kemunculan di baris yang sama
        while ((col = hay.indexOf(needle, col + needle.length)) >= 0) {
          total++;
          if (total > args.offset && matches.length < args.maxResults) {
            matches.push({ path: file.slice(root.length + 1).replaceAll("\\", "/"), line: i + 1, column: col + 1, preview: line.trim().slice(0, PREVIEW_CHARS) });
          }
        }
      }
    }
  }
  return { matches, totalMatches: total, nextOffset: total > args.offset + matches.length ? args.offset + matches.length : null, filesScanned };
}

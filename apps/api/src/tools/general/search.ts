import { createHash } from "node:crypto";
import { lstat, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { ToolResultError } from "../errors";
import { defineTool, objectSchema, stringField } from "../types";
import { workspacePath, workspaceRoot } from "./files";

const pathSchema = z.string().min(1).max(1000);
const MAX_RESULTS = 200;
const PREVIEW_CHARS = 240;

/** Ekstensi yang hampir pasti bukan teks untuk dibaca baris demi baris. */
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|bmp|pdf|zip|7z|rar|gz|tgz|tar|xz|docx?|xlsx?|pptx?|exe|dll|so|dylib|bin|wasm|mp3|mp4|mov|avi|sqlite|db|ros-help)$/i;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".venv", "venv", "__pycache__", ".cache", "target", "coverage", ".bun"]);

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

interface CodeMatch {
  path: string;
  line: number;
  column: number;
  preview: string;
}

/** Cari baris yang memuat query (literal, opsional regex) — hasil terstruktur. */
async function searchInFiles(root: string, args: { query: string; regex: boolean; caseSensitive: boolean; filePattern?: string; maxResults: number; offset: number }): Promise<{ matches: CodeMatch[]; totalMatches: number; nextOffset: number | null; filesScanned: number }> {
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

export function createSearchTools(baseDir: string) {
  const root = async (userId: string) => workspaceRoot(baseDir, userId);
  const codeSearchSchema = z.object({
    query: z.string().min(1).max(500),
    path: pathSchema.default("."),
    filePattern: z.string().min(1).max(200).optional(),
    regex: z.boolean().default(false),
    caseSensitive: z.boolean().default(false),
    maxResults: z.number().int().min(1).max(MAX_RESULTS).default(50),
    offset: z.number().int().min(0).default(0),
  }).strict();
  return [
    defineTool({ name: "general:search_code", connector: "workspace", tags: ["code", "search", "read", "grep"],
      description: "Cari teks/regex di file kode workspace. Hasil terstruktur {path, line, column, preview} — bukan grep shell. Pakai offset untuk lanjutan hasil.",
      schema: codeSearchSchema, parameters: objectSchema({ query: stringField, path: stringField, filePattern: stringField, regex: { type: "boolean" }, caseSensitive: { type: "boolean" }, maxResults: { type: "integer", minimum: 1, maximum: MAX_RESULTS }, offset: { type: "integer", minimum: 0 } }, ["query"]),
      execute: async (args, run) => searchInFiles(await root(run.userId), args) }),
    defineTool({ name: "general:search_files", connector: "workspace", tags: ["file", "search", "find", "read"],
      description: "Cari file/folder berdasarkan pola nama (glob sederhana via regex, mis. '.*\\.ts$') di workspace. Lebih tepat daripada ls recursive via shell.",
      schema: z.object({ pattern: z.string().min(1).max(200), path: pathSchema.default("."), maxResults: z.number().int().min(1).max(200).default(50) }).strict(),
      parameters: objectSchema({ pattern: stringField, path: stringField, maxResults: { type: "integer", minimum: 1, maximum: 200 } }, ["pattern"]),
      execute: async (args, run) => {
        const workspaceRootPath = await root(run.userId);
        const base = await workspacePath(workspaceRootPath, args.path);
        const re = new RegExp(args.pattern, "i");
        const out: string[] = [];
        const walk = async (dir: string, depth: number): Promise<void> => {
          if (out.length >= args.maxResults || depth > 10) return;
          let entries;
          try {
            entries = await readdir(dir, { withFileTypes: true });
          } catch {
            return;
          }
          for (const e of entries) {
            if (out.length >= args.maxResults) return;
            if (e.isSymbolicLink()) continue;
            const rel = dir === workspaceRootPath ? e.name : dir.slice(workspaceRootPath.length + 1) + "/" + e.name;
            if (e.isDirectory()) {
              if (SKIP_DIRS.has(e.name)) continue;
              if (re.test(e.name)) out.push(rel.replaceAll("\\", "/") + "/");
              await walk(join(dir, e.name), depth + 1);
            } else if (re.test(e.name)) out.push(rel.replaceAll("\\", "/"));
          }
        };
        await walk(base, 0);
        return { files: out, truncated: out.length >= args.maxResults };
      } }),
    defineTool({ name: "general:replace_text", connector: "workspace", permission: "write", tags: ["code", "edit", "write"],
      description: "Ganti semua kemunculan teks lama dengan teks baru dalam satu file. Wajib expectedHash dari general:read_file agar tidak menimpa perubahan lain.",
      schema: z.object({ path: pathSchema, oldText: z.string().min(1).max(50_000), newText: z.string().max(50_000), expectedHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
      parameters: objectSchema({ path: stringField, oldText: stringField, newText: stringField, expectedHash: stringField }, ["path", "oldText", "newText", "expectedHash"]),
      execute: async (args, run) => {
        const workspaceRootPath = await root(run.userId);
        const file = await workspacePath(workspaceRootPath, args.path);
        const current = await readFile(file).catch(() => null);
        if (current === null) throw new ToolResultError("FILE_NOT_FOUND", `File ${args.path} tidak ditemukan.`);
        if (createHash("sha256").update(current).digest("hex") !== args.expectedHash) {
          throw new ToolResultError("FILE_CHANGED", "File berubah sejak dibaca. Baca ulang lalu ulangi dengan hash terbaru.");
        }
        const text = current.toString("utf8");
        if (!text.includes(args.oldText)) throw new ToolResultError("VALIDATION_FAILED", "oldText tidak ditemukan di file. Periksa isi terkini dengan general:read_file.");
        const occurrences = text.split(args.oldText).length - 1;
        await writeFile(file, text.split(args.oldText).join(args.newText));
        return { path: args.path, replacements: occurrences, sha256: createHash("sha256").update(args.newText).digest("hex") };
      } }),
  ];
}

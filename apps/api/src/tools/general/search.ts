import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { ToolResultError } from "../errors";
import { defineTool, objectSchema, stringField } from "../types";
import { workspacePath, workspaceRoot } from "./files";
import { SKIP_DIRS, searchInFiles } from "./search-scan";

const pathSchema = z.string().min(1).max(1000);
const MAX_RESULTS = 200;

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

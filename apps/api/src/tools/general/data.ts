import { readFile } from "node:fs/promises";
import { z } from "zod";
import { ToolResultError } from "../errors";
import { defineTool, objectSchema, stringField } from "../types";
import { workspacePath, workspaceRoot } from "./files";

const pathSchema = z.string().min(1).max(1000);

/** Ambil teks dari argumen inline atau file workspace (inline diutamakan). */
async function textFrom(inline: string | undefined, path: string | undefined, userId: string, baseDir: string): Promise<string> {
  if (inline !== undefined) return inline;
  if (!path) throw new ToolResultError("VALIDATION_FAILED", "Berikan text inline atau path file.");
  const file = await workspacePath(await workspaceRoot(baseDir, userId), path);
  const bytes = await readFile(file).catch(() => null);
  if (bytes === null) throw new ToolResultError("FILE_NOT_FOUND", `File ${path} tidak ditemukan.`);
  if (bytes.length > 5_000_000) throw new ToolResultError("VALIDATION_FAILED", "File data maksimal 5 MB untuk tools data.");
  return bytes.toString("utf8");
}

/** Parser JSON dengan path dot sederhana (a.b[0].c) dan wildcard dasar. */
function queryJson(value: unknown, dotPath: string): unknown {
  let current: unknown = value;
  for (const rawSegment of dotPath.split(".")) {
    if (rawSegment === "") continue;
    const arrayMatch = /^(\w+)\[(\d+)\]$/.exec(rawSegment);
    if (arrayMatch) {
      const key = arrayMatch[1]!;
      const obj = current as Record<string, unknown> | undefined;
      current = obj?.[key];
      const arr = current as unknown[] | undefined;
      current = arr?.[Number(arrayMatch[2]!)];
    } else if (rawSegment === "*") {
      const arr = current as unknown[] | undefined;
      current = arr;
    } else {
      const obj = current as Record<string, unknown> | undefined;
      if (obj === undefined || typeof obj !== "object" || !(rawSegment in obj)) throw new ToolResultError("VALIDATION_FAILED", `Path "${dotPath}" berhenti di "${rawSegment}" — properti tidak ditemukan.`);
      current = obj[rawSegment];
    }
  }
  return current;
}

export function createDataTools(baseDir: string) {
  const jsonParams = (required: string[]) => objectSchema({ text: stringField, path: stringField, indent: { type: "integer", minimum: 0, maximum: 8 }, query: stringField }, required);
  return [
    defineTool({ name: "data:parse_json", connector: "workspace", tags: ["data", "json", "read"],
      description: "Parse JSON (inline text atau file workspace) → struktur ringkas: keys, tipe, ukuran. Bukan eksekusi shell/Python.",
      schema: z.object({ text: z.string().max(1_000_000).optional(), path: pathSchema.optional(), query: z.string().max(500).optional() }).strict(),
      parameters: jsonParams([]),
      execute: async (args, run) => {
        const raw = await textFrom(args.text, args.path, run.userId, baseDir);
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch (err) {
          throw new ToolResultError("VALIDATION_FAILED", `JSON tidak valid: ${err instanceof Error ? err.message : String(err)}`);
        }
        if (args.query) parsed = queryJson(parsed, args.query);
        return { valid: true, preview: JSON.stringify(parsed, null, 1).slice(0, 4000), type: Array.isArray(parsed) ? `array(${parsed.length})` : typeof parsed };
      } }),
    defineTool({ name: "data:validate_json", connector: "workspace", tags: ["data", "json", "validate"],
      description: "Validasi JSON — ok/posisi error, tanpa mengubah apa pun.",
      schema: z.object({ text: z.string().max(1_000_000).optional(), path: pathSchema.optional() }).strict(),
      parameters: jsonParams([]),
      execute: async (args, run) => {
        const raw = await textFrom(args.text, args.path, run.userId, baseDir);
        try {
          JSON.parse(raw);
          return { valid: true };
        } catch (err) {
          return { valid: false, error: err instanceof Error ? err.message : String(err) };
        }
      } }),
    defineTool({ name: "data:format_json", connector: "workspace", tags: ["data", "json", "format"],
      description: "Format pretty-print JSON dengan indentasi pilihan.",
      schema: z.object({ text: z.string().max(1_000_000).optional(), path: pathSchema.optional(), indent: z.number().int().min(0).max(8).default(2) }).strict(),
      parameters: jsonParams(["indent"]),
      execute: async (args, run) => {
        const raw = await textFrom(args.text, args.path, run.userId, baseDir);
        try {
          return { formatted: JSON.stringify(JSON.parse(raw), null, args.indent).slice(0, 100_000) };
        } catch (err) {
          throw new ToolResultError("VALIDATION_FAILED", `JSON tidak valid: ${err instanceof Error ? err.message : String(err)}`);
        }
      } }),
    defineTool({ name: "data:query_json", connector: "workspace", tags: ["data", "json", "query"],
      description: "Ambil bagian JSON via path dot (a.b[0].c, a.* untuk array) — hemat dibaca read_file penuh.",
      schema: z.object({ text: z.string().max(1_000_000).optional(), path: pathSchema.optional(), query: z.string().min(1).max(500) }).strict(),
      parameters: jsonParams(["query"]),
      execute: async (args, run) => {
        const raw = await textFrom(args.text, args.path, run.userId, baseDir);
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          throw new ToolResultError("VALIDATION_FAILED", "Sumber bukan JSON valid.");
        }
        return { result: queryJson(parsed, args.query) };
      } }),
  ];
}

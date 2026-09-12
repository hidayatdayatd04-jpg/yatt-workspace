import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { ToolResultError } from "../errors";
import { defineTool, objectSchema, stringField } from "../types";
import { workspacePath, workspaceRoot } from "./files";

const pathSchema = z.string().min(1).max(1000);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export interface PatchBlock {
  search: string;
  replace: string;
  replaceAll?: boolean;
}

/**
 * Terapkan blok SEARCH/REPLACE pada satu teks (all-or-nothing). Setiap blok
 * wajib cocok unik (atau replaceAll eksplisit); kegagalan menunjuk blok ke-n
 * tanpa mengubah file.
 */
function applyBlocks(text: string, blocks: PatchBlock[]): { text: string; applied: number[] } {
  let out = text;
  const applied: number[] = [];
  blocks.forEach((block, idx) => {
    const occurrences = out.split(block.search).length - 1;
    if (occurrences === 0) {
      throw new ToolResultError("VALIDATION_FAILED", `Blok ${idx + 1}: teks SEARCH tidak ditemukan. Baca ulang file — konten mungkin berubah.`, { retryable: false });
    }
    if (occurrences > 1 && !block.replaceAll) {
      throw new ToolResultError("VALIDATION_FAILED", `Blok ${idx + 1}: teks SEARCH cocok ${occurrences} kali. Persempit konteks blok atau set replaceAll:true.`, { retryable: false });
    }
    out = block.replaceAll ? out.split(block.search).join(block.replace) : out.replace(block.search, block.replace);
    applied.push(idx + 1);
  });
  return { text: out, applied };
}

export function createPatchTools(baseDir: string) {
  return [
    defineTool({ name: "general:apply_patch", connector: "workspace", permission: "write", tags: ["code", "edit", "patch", "write"],
      description: "Edit file dengan blok SEARCH/REPLACE (atomic, tanpa menulis ulang seluruh file). Wajib expectedHash dari read_file; bila hash berubah, file TIDAK dimodifikasi — baca ulang dulu. Semua blok tervalidasi sebelum ada yang diterapkan.",
      schema: z.object({
        path: pathSchema,
        blocks: z.array(z.object({ search: z.string().min(1).max(50_000), replace: z.string().max(50_000), replaceAll: z.boolean().optional() }).strict()).min(1).max(20),
        expectedHash: sha256Schema,
        createNewFile: z.boolean().optional(),
      }).strict(),
      parameters: objectSchema({
        path: stringField,
        blocks: { type: "array", items: { type: "object", properties: { search: stringField, replace: stringField, replaceAll: { type: "boolean" } }, required: ["search", "replace"] } },
        expectedHash: stringField,
        createNewFile: { type: "boolean" },
      }, ["path", "blocks", "expectedHash"]),
      execute: async (args, run) => {
        const root = await workspaceRoot(baseDir, run.userId);
        const file = await workspacePath(root, args.path);
        const current = await readFile(file).catch(() => null);
        if (current === null && !args.createNewFile) {
          throw new ToolResultError("FILE_NOT_FOUND", `File ${args.path} tidak ditemukan. Gunakan createNewFile atau write_file.`);
        }
        const text = current?.toString("utf8") ?? "";
        if (createHash("sha256").update(text).digest("hex") !== args.expectedHash) {
          throw new ToolResultError("FILE_CHANGED", "Hash tidak cocok — file berubah sejak dibaca. Operasi dibatalkan. Baca ulang dengan general:read_file dan ulangi dengan hash terbaru.");
        }
        const { text: next, applied } = applyBlocks(text, args.blocks);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, next);
        return { path: args.path, blocksApplied: applied, bytes: Buffer.byteLength(next), sha256: createHash("sha256").update(next).digest("hex") };
      } }),
  ];
}

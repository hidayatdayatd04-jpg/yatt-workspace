import type { StartRunInput } from "../../agent/loop/types";
import { readFileContent, type DescribeImage } from "../../services/file-extract/read";
import { createHash } from "node:crypto";
import { mkdir, lstat, readdir, readFile, writeFile } from "node:fs/promises";
import { createZipExtractionTool } from "./zip-extract";
import { workspacePath, workspaceRoot } from "./file-paths";
export { workspacePath, workspaceRoot } from "./file-paths";
import { z } from "zod";
import { defineTool, objectSchema, stringField } from "../types";

const pathSchema = z.string().min(1).max(1000);
export function createFileTools(baseDir: string, describeImage?: (image: Parameters<DescribeImage>[0], run: StartRunInput) => Promise<string>) {
  const target = async (userId: string, path: string) => workspacePath(await workspaceRoot(baseDir, userId), path);
  return [
    defineTool({ name: "general:list_files", connector: "workspace", description: "Daftar file dan folder kode di workspace agent. Path relatif; gunakan . untuk root.", schema: z.object({ path: pathSchema.default(".") }).strict(), parameters: objectSchema({ path: stringField }),
      execute: async (args, run) => (await readdir(await target(run.userId, args.path), { withFileTypes: true })).slice(0, 250).map((e) => ({ name: e.name, type: e.isSymbolicLink() ? "link" : e.isDirectory() ? "directory" : "file" })) }),
    defineTool({ name: "general:read_file", connector: "workspace", description: "Baca isi teks, JSON, kode, PDF, Office, atau daftar ZIP di workspace. Gunakan offset untuk halaman selanjutnya dan entryPath untuk isi file dalam ZIP. Lampiran chat dibaca lewat general:read_attachment.", schema: z.object({ path: pathSchema, offset: z.number().int().min(0).default(0), entryPath: pathSchema.optional(), page: z.number().int().min(1).optional() }).strict(), parameters: objectSchema({ path: stringField, offset: { type: "integer", minimum: 0 }, entryPath: stringField, page: { type: "integer", minimum: 1 } }, ["path"]),
      execute: async (args, run) => {
        const file = await target(run.userId, args.path);
        if ((await lstat(file)).size > 25_000_000) throw new Error("File terlalu besar untuk dibaca (maksimal 25 MB).");
        return { path: args.path, ...await readFileContent({ name: args.path, bytes: await readFile(file), offset: args.offset, entryPath: args.entryPath, page: args.page, describeImage: describeImage ? (image) => describeImage(image, run) : undefined }) };
      } }),
    defineTool({ name: "general:write_file", connector: "workspace", permission: "write", description: "Buat atau timpa file kode/teks. Baca dulu via general:read_file bila butuh konteks; expectedHash (sha256 dari read_file) opsional untuk mencegah menimpa perubahan terbaru.", schema: z.object({ path: pathSchema, content: z.string().max(200_000), expectedHash: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict(), parameters: objectSchema({ path: stringField, content: stringField, expectedHash: stringField }, ["path", "content"]),
      execute: async (args, run) => {
        const file = await target(run.userId, args.path);
        if (args.expectedHash) {
          const current = await readFile(file);
          if (createHash("sha256").update(current).digest("hex") !== args.expectedHash) throw new Error("File berubah. Baca ulang sebelum menimpa.");
        }
        const { dirname } = await import("node:path");
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, args.content, { flag: "w" });
        return { path: args.path, bytes: Buffer.byteLength(args.content), sha256: createHash("sha256").update(args.content).digest("hex"), downloadUrl: `/api/workspace/download?path=${encodeURIComponent(args.path)}` };
      } }),
    createZipExtractionTool(baseDir),
  ];
}

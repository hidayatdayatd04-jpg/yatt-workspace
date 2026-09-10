import { createHash } from "node:crypto";
import { mkdir, lstat, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { unzipSync } from "fflate";
import { z } from "zod";
import { defineTool, objectSchema, stringField } from "../types";

const pathSchema = z.string().min(1).max(1000);
export async function workspaceRoot(baseDir: string, userId: string) {
  const root = resolve(baseDir, "workspaces", createHash("sha256").update(userId).digest("hex"));
  await mkdir(root, { recursive: true });
  return realpath(root);
}
/** Reject traversal and links (including Windows junctions) for every existing path component. */
export async function workspacePath(root: string, path: string) {
  if (isAbsolute(path) || /[:\x00]/.test(path)) throw new Error("Gunakan path relatif di workspace.");
  const destination = resolve(root, path);
  const rel = relative(root, destination);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error("Path di luar workspace ditolak.");
  let part = root;
  for (const segment of rel.split(sep).filter(Boolean)) {
    part = resolve(part, segment);
    const stat = await lstat(part).catch((err: NodeJS.ErrnoException) => { if (err.code === "ENOENT") return null; throw err; });
    if (stat?.isSymbolicLink()) throw new Error("Symlink dan junction tidak boleh diakses oleh tools file.");
  }
  return destination;
}
export function createFileTools(baseDir: string) {
  const target = async (userId: string, path: string) => workspacePath(await workspaceRoot(baseDir, userId), path);
  return [
    defineTool({ name: "general:list_files", connector: "workspace", description: "Daftar file dan folder kode di workspace agent. Path relatif; gunakan . untuk root.", schema: z.object({ path: pathSchema.default(".") }).strict(), parameters: objectSchema({ path: stringField }),
      execute: async (args, run) => (await readdir(await target(run.userId, args.path), { withFileTypes: true })).slice(0, 250).map((e) => ({ name: e.name, type: e.isSymbolicLink() ? "link" : e.isDirectory() ? "directory" : "file" })) }),
    defineTool({ name: "general:read_file", connector: "workspace", description: "Baca file teks atau kode di workspace; mendukung offset untuk membaca file panjang.", schema: z.object({ path: pathSchema, offset: z.number().int().min(0).default(0) }).strict(), parameters: objectSchema({ path: stringField, offset: { type: "integer", minimum: 0 } }, ["path"]),
      execute: async (args, run) => {
        const file = await target(run.userId, args.path);
        if ((await lstat(file)).size > 2_000_000) throw new Error("File terlalu besar untuk dibaca (maksimal 2 MB).");
        const content = await readFile(file, "utf8");
        return { path: args.path, content: content.slice(args.offset, args.offset + 6000), nextOffset: args.offset + 6000 < content.length ? args.offset + 6000 : null, sha256: createHash("sha256").update(content).digest("hex") };
      } }),
    defineTool({ name: "general:write_file", connector: "workspace", permission: "write", description: "Buat atau edit file kode/teks. Untuk menimpa file wajib expectedHash dari read_file agar perubahan lain tidak hilang.", schema: z.object({ path: pathSchema, content: z.string().max(200_000), expectedHash: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict(), parameters: objectSchema({ path: stringField, content: stringField, expectedHash: stringField }, ["path", "content"]),
      execute: async (args, run) => {
        const file = await target(run.userId, args.path);
        if (args.expectedHash) {
          const current = await readFile(file);
          if (createHash("sha256").update(current).digest("hex") !== args.expectedHash) throw new Error("File berubah. Baca ulang sebelum menimpa.");
        }
        const { dirname } = await import("node:path");
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, args.content, { flag: args.expectedHash ? "w" : "wx" });
        return { path: args.path, bytes: Buffer.byteLength(args.content), sha256: createHash("sha256").update(args.content).digest("hex"), downloadUrl: `/api/workspace/download?path=${encodeURIComponent(args.path)}` };
      } }),
    defineTool({ name: "general:extract_zip", connector: "workspace", permission: "write", description: "Ekstrak arsip ZIP di workspace ke folder baru. Menolak path traversal, symlink, overwrite, dan arsip terlalu besar.", schema: z.object({ path: pathSchema, destination: pathSchema }).strict(), parameters: objectSchema({ path: stringField, destination: stringField }, ["path", "destination"]),
      execute: async (args, run) => {
        const file = await target(run.userId, args.path);
        if ((await lstat(file)).size > 10_000_000) throw new Error("ZIP maksimal 10 MB.");
        let count = 0, total = 0;
        const entries = unzipSync(await readFile(file), { filter: (entry) => {
          count++; total += entry.originalSize;
          if (count > 500 || total > 25_000_000 || entry.originalSize > 5_000_000) throw new Error("Batas ekstraksi ZIP terlampaui.");
          return true;
        } });
        const destination = await target(run.userId, args.destination);
        // Validate the entire archive before writing any entry. ZIP entries are always materialized as regular files.
        const paths = await Promise.all(Object.entries(entries).map(async ([name, bytes]) => ({ name, bytes, file: await workspacePath(destination, name.replaceAll("\\", "/")) })));
        await mkdir(destination, { recursive: false });
        const { dirname } = await import("node:path");
        for (const item of paths) {
          if (item.name.endsWith("/")) await mkdir(item.file, { recursive: true });
          else { await mkdir(dirname(item.file), { recursive: true }); await writeFile(item.file, item.bytes, { flag: "wx" }); }
        }
        return { destination: args.destination, files: paths.length, bytes: total };
      } }),
  ];
}

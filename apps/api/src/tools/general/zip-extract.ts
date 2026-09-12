import { dirname, relative, resolve } from "node:path";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { unzip, type Unzipped } from "fflate";
import { z } from "zod";
import { defineTool, objectSchema, stringField } from "../types";
import { ToolResultError } from "../errors";
import { workspacePath, workspaceRoot } from "./file-paths";
import { inspectZip, ZIP_LIMITS, zipLimit } from "../../services/file-extract/zip-limits";

export function createZipExtractionTool(baseDir: string) {
  const path = z.string().min(1).max(1000);
  const entriesSchema = z.array(z.string().min(1).max(1000)).max(200).optional();
  return defineTool({ name: "general:extract_zip", connector: "workspace", permission: "write",
    description: "Ekstrak ZIP maksimal 25 MB ke folder baru: hingga 10.000 entri, 100 MB per file, 250 MB total hasil. Untuk arsip besar isi entries dengan daftar entryPath agar hanya file relevan yang diekstrak. Menolak path traversal dan overwrite. Untuk sekadar membaca isi gunakan read_file dengan entryPath.",
    schema: z.object({ path, destination: path, entries: entriesSchema }).strict(), parameters: objectSchema({ path: stringField, destination: stringField, entries: { type: "array", items: stringField } }, ["path", "destination"]),
    execute: async (args, run, signal) => {
      const root = await workspaceRoot(baseDir, run.userId);
      const file = await workspacePath(root, args.path);
      let size: number;
      try {
        size = (await lstat(file)).size;
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
          throw new ToolResultError("FILE_NOT_FOUND", `Arsip "${args.path}" tidak ditemukan di workspace.`, {
            guidance: "Periksa path via general:list_files. Bila dari lampiran chat, impor dulu via general:import_attachment ke path yang belum ada.",
          });
        }
        throw err;
      }
      if (size > ZIP_LIMITS.compressedBytes) zipLimit("ukuran arsip (byte)", size, ZIP_LIMITS.compressedBytes);
      const bytes = await readFile(file);
      const index = inspectZip(bytes);
      const byName = new Map(index.map((e) => [e.name, e]));
      let wanted = index;
      if (args.entries?.length) {
        const missing = args.entries.filter((n) => !byName.has(n));
        if (missing.length) throw new Error(`Entri tidak ditemukan di ZIP: ${missing.slice(0, 5).join(", ")}. Baca daftar ZIP dulu via read_file tanpa entryPath.`);
        wanted = args.entries.map((n) => byName.get(n)!);
      }
      let total = 0;
      for (const entry of wanted) {
        if (entry.sizeBytes > ZIP_LIMITS.entryBytes) zipLimit(`ukuran file ${entry.name} (byte)`, entry.sizeBytes, ZIP_LIMITS.entryBytes);
        if (!entry.directory) {
          total += entry.sizeBytes;
          if (total > ZIP_LIMITS.expandedBytes) zipLimit("total hasil (byte)", total, ZIP_LIMITS.expandedBytes);
        }
      }
      const destination = await workspacePath(root, args.destination);
      const paths = new Map<string, string>();
      const occupied = new Map<string, boolean>();
      for (const entry of wanted) {
        const target = await workspacePath(destination, entry.name.replaceAll("\\", "/"));
        const key = process.platform === "win32" ? target.toLowerCase() : target;
        if (occupied.has(key) || target === destination && !entry.directory) throw new Error("Path entri ZIP bertabrakan.");
        occupied.set(key, entry.directory);
        paths.set(entry.name, target);
      }
      for (const target of paths.values()) {
        for (let parent = dirname(target); parent !== dirname(destination); parent = dirname(parent)) {
          if (occupied.get(process.platform === "win32" ? parent.toLowerCase() : parent) === false) throw new Error("File ZIP bertabrakan dengan folder.");
        }
      }
      signal?.throwIfAborted();
      const selective = args.entries?.length ? new Set(args.entries) : null;
      // fflate memakai worker untuk inflasi besar agar SSE tetap dapat mengalir.
      const files = await new Promise<Unzipped>((accept, reject) => {
        let cancel = () => {};
        let finished = false;
        const abort = () => { cancel(); reject(signal?.reason ?? new Error("Ekstraksi dibatalkan.")); };
        const done = (error: Error | null, result?: Unzipped) => {
          finished = true; signal?.removeEventListener("abort", abort);
          if (error) reject(error); else accept(result!);
        };
        cancel = selective
          ? unzip(bytes, { filter: (entry) => selective.has(entry.name) }, done)
          : unzip(bytes, done);
        if (!finished) signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
      });
      const actual = Object.values(files).reduce((sum, data) => sum + data.length, 0);
      if (actual > ZIP_LIMITS.expandedBytes) zipLimit("total hasil (byte)", actual, ZIP_LIMITS.expandedBytes);
      signal?.throwIfAborted();
      try {
        await mkdir(dirname(destination), { recursive: true });
        await mkdir(destination, { recursive: false });
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "EEXIST") {
          throw new ToolResultError("TOOL_FAILED", `Folder tujuan "${args.destination}" sudah ada di workspace.`, {
            guidance: "Tujuan sudah ada. Lanjutkan dengan file di dalamnya via general:list_files/general:read_file, atau ulangi ekstrak ke destination lain yang belum ada.",
          });
        }
        throw err;
      }
      try {
        for (const [name, data] of Object.entries(files)) {
          signal?.throwIfAborted();
          const target = paths.get(name)!;
          if (data.length > ZIP_LIMITS.entryBytes) zipLimit(`ukuran file ${name} (byte)`, data.length, ZIP_LIMITS.entryBytes);
          if (name.endsWith("/")) await mkdir(target, { recursive: true });
          else { await mkdir(dirname(target), { recursive: true }); await writeFile(target, data, { flag: "wx" }); }
        }
      } catch (error) {
        const owned = await workspacePath(root, relative(root, destination));
        if (owned !== resolve(root)) await rm(owned, { recursive: true, force: true });
        throw error;
      }
      return { destination: args.destination, files: wanted.filter((entry) => !entry.directory).length, bytes: actual };
    },
  });
}

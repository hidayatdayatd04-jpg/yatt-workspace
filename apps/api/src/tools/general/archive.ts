import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { zipSync, type Zippable } from "fflate";
import { z } from "zod";
import { ToolResultError } from "../errors";
import { defineTool, objectSchema, stringField } from "../types";
import { workspacePath, workspaceRoot } from "./files";

const pathSchema = z.string().min(1).max(1000);
const MAX_ARCHIVE_BYTES = 25_000_000;
const MAX_ARCHIVE_FILES = 500;

/** archive:create — bungkus folder/file workspace menjadi ZIP dengan batas. */
export function createArchiveTools(baseDir: string) {
  return [
    defineTool({ name: "archive:create", connector: "workspace", permission: "write", tags: ["archive", "zip", "write"],
      description: "Buat arsip ZIP dari folder/file di workspace (maks 25 MB / 500 file, node_modules & .git dilewati).",
      schema: z.object({ source: pathSchema, destination: pathSchema.optional() }).strict(),
      parameters: objectSchema({ source: stringField, destination: stringField }, ["source"]),
      execute: async (args, run) => {
        const root = await workspaceRoot(baseDir, run.userId);
        const source = await workspacePath(root, args.source);
        const dest = args.destination ? await workspacePath(root, args.destination) : join(root, `${args.source.replace(/[/\\]+$/, "")}.zip`);
        const lstat = await stat(source).catch(() => null);
        if (lstat === null) throw new ToolResultError("FILE_NOT_FOUND", `Sumber ${args.source} tidak ditemukan.`);
        const payload: Zippable = {};
        let count = 0;
        let total = 0;
        const SKIP = new Set(["node_modules", ".git", "dist", ".next", "__pycache__", ".venv"]);
        const addFile = async (abs: string, rel: string) => {
          const info = await stat(abs).catch(() => null);
          if (info === null || !info.isFile()) return;
          if (info.isSymbolicLink()) throw new ToolResultError("PATH_OUTSIDE_WORKSPACE", `Symlink ${rel} ditolak.`);
          if (info.size > 5_000_000) throw new ToolResultError("VALIDATION_FAILED", `File ${rel} melebihi 5 MB per file.`);
          count++;
          total += info.size;
          if (count > MAX_ARCHIVE_FILES) throw new ToolResultError("VALIDATION_FAILED", `Melebihi ${MAX_ARCHIVE_FILES} file.`);
          if (total > MAX_ARCHIVE_BYTES) throw new ToolResultError("VALIDATION_FAILED", `Total melebihi ${MAX_ARCHIVE_BYTES / 1_000_000} MB.`);
          payload[rel] = new Uint8Array(await readFile(abs));
        };
        if (lstat.isFile()) {
          await addFile(source, source.slice(root.length + 1).replaceAll("\\", "/"));
        } else {
          const walk = async (dir: string, rel: string) => {
            const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
            for (const e of entries) {
              if (e.isSymbolicLink() || SKIP.has(e.name)) continue;
              const childRel = rel ? `${rel}/${e.name}` : e.name;
              if (e.isDirectory()) await walk(join(dir, e.name), childRel);
              else await addFile(join(dir, e.name), childRel);
            }
          };
          await walk(source, "");
        }
        if (count === 0) throw new ToolResultError("VALIDATION_FAILED", "Tidak ada file untuk diarsipkan.");
        const zipped = zipSync(payload, { level: 6 });
        await writeFile(dest, zipped, { flag: "wx" });
        return { destination: dest.slice(root.length + 1).replaceAll("\\", "/"), files: count, bytes: zipped.byteLength };
      } }),
  ];
}

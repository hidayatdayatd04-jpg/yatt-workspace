import { and, eq } from "drizzle-orm";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import type { Database } from "../../db";
import { attachments } from "../../db/schema";
import { defineTool, objectSchema, stringField } from "../types";
import { ToolResultError } from "../errors";
import { workspacePath, workspaceRoot } from "./files";

export function createAttachmentTool(deps: { db: Database; dataDir: string; readObject: (key: string) => Promise<Buffer> }) {
  return defineTool({ name: "general:import_attachment", connector: "workspace", permission: "write", description: "Salin lampiran percakapan ke workspace supaya dapat dibaca sebagai file, diedit, atau diekstrak jika ZIP. Idempoten bila isi sama. Hanya lampiran milik pengguna pada chat ini. Gunakan attachmentId dari konteks pesan.", schema: z.object({ attachmentId: z.string().uuid(), path: z.string().min(1).max(1000) }).strict(), parameters: objectSchema({ attachmentId: stringField, path: stringField }, ["attachmentId", "path"]),
    execute: async (args, run) => {
      const [row] = await deps.db.select().from(attachments).where(and(eq(attachments.id, args.attachmentId), eq(attachments.userId, run.userId), eq(attachments.conversationId, run.conversationId), eq(attachments.status, "ready"))).limit(1);
      if (!row) throw new Error("Lampiran tidak tersedia pada percakapan ini.");
      if (row.sizeBytes > 25_000_000) throw new Error("Lampiran maksimal 25 MB untuk workspace.");
      const file = await workspacePath(await workspaceRoot(deps.dataDir, run.userId), args.path);
      const bytes = await deps.readObject(row.objectKey);
      if (bytes.length > 25_000_000) throw new Error("Lampiran melebihi batas workspace.");
      await mkdir(dirname(file), { recursive: true });
      try {
        await writeFile(file, bytes, { flag: "wx" });
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code !== "EEXIST") throw err;
        const stat = await lstat(file).catch(() => null);
        if (stat?.isDirectory()) {
          throw new ToolResultError("TOOL_FAILED", `Path "${args.path}" sudah ada sebagai folder di workspace.`, {
            guidance: "Tujuan sudah dipakai folder. Pilih path file lain yang belum ada, atau baca daftar workspace via general:list_files.",
          });
        }
        const existing = await readFile(file).catch(() => null);
        if (existing && Buffer.from(existing).equals(bytes)) return { path: args.path, bytes: bytes.length, reused: true };
        throw new ToolResultError("TOOL_FAILED", `File "${args.path}" sudah ada di workspace dengan isi berbeda.`, {
          guidance: "File tujuan sudah ada. Lanjutkan dengan file tersebut via general:read_file/general:list_files, atau ulangi import ke path lain yang belum ada.",
        });
      }
      return { path: args.path, bytes: bytes.length };
    } });
}

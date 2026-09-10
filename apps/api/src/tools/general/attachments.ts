import { and, eq } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import type { Database } from "../../db";
import { attachments } from "../../db/schema";
import { defineTool, objectSchema, stringField } from "../types";
import { workspacePath, workspaceRoot } from "./files";

export function createAttachmentTool(deps: { db: Database; dataDir: string; readObject: (key: string) => Promise<Buffer> }) {
  return defineTool({ name: "general:import_attachment", connector: "workspace", permission: "write", description: "Salin lampiran percakapan ke workspace supaya dapat dibaca sebagai file, diedit, atau diekstrak jika ZIP. Hanya lampiran milik pengguna pada chat ini. Gunakan attachmentId dari konteks pesan.", schema: z.object({ attachmentId: z.string().uuid(), path: z.string().min(1).max(1000) }).strict(), parameters: objectSchema({ attachmentId: stringField, path: stringField }, ["attachmentId", "path"]),
    execute: async (args, run) => {
      const [row] = await deps.db.select().from(attachments).where(and(eq(attachments.id, args.attachmentId), eq(attachments.userId, run.userId), eq(attachments.conversationId, run.conversationId), eq(attachments.status, "ready"))).limit(1);
      if (!row) throw new Error("Lampiran tidak tersedia pada percakapan ini.");
      if (row.sizeBytes > 10_000_000) throw new Error("Lampiran maksimal 10 MB untuk workspace.");
      const file = await workspacePath(await workspaceRoot(deps.dataDir, run.userId), args.path);
      const bytes = await deps.readObject(row.objectKey);
      if (bytes.length > 10_000_000) throw new Error("Lampiran melebihi batas workspace.");
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, bytes, { flag: "wx" });
      return { path: args.path, bytes: bytes.length };
    } });
}

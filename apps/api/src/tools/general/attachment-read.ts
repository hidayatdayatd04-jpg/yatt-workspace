import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db";
import { attachments } from "../../db/schema";
import { readFileContent, type DescribeImage } from "../../services/file-extract/read";
import { defineTool, objectSchema, stringField } from "../types";
import type { StartRunInput } from "../../agent/loop/types";
import { detectContentKind } from "../../services/file-extract/detect";

export function createAttachmentReadTools(deps: { db: Database; readObject: (key: string) => Promise<Buffer>;
  describeImage?: (input: Parameters<DescribeImage>[0], run: StartRunInput) => Promise<string> }) {
  const scope = (run: StartRunInput) => and(eq(attachments.userId, run.userId), eq(attachments.conversationId, run.conversationId), eq(attachments.status, "ready"));
  return [
    defineTool({ name: "general:list_attachments", connector: "workspace", description: "Daftar semua lampiran file/gambar dalam percakapan ini beserta attachmentId. Gunakan untuk file dari pesan sebelumnya; lampiran tidak otomatis berada di root workspace.",
      schema: z.object({ offset: z.number().int().min(0).default(0) }).strict(), parameters: objectSchema({ offset: { type: "integer", minimum: 0 } }),
      execute: async (args, run) => {
        const rows = await deps.db.select().from(attachments).where(scope(run)).orderBy(asc(attachments.createdAt)).limit(101).offset(args.offset);
        return { attachments: rows.slice(0, 100).map((row) => ({ attachmentId: row.id, name: row.originalName, mime: row.contentType, bytes: row.sizeBytes })),
          nextOffset: rows.length > 100 ? args.offset + 100 : null };
      } }),
    defineTool({ name: "general:read_attachment", connector: "workspace", description: "Baca lampiran chat langsung tanpa impor atau izin tulis: teks/JSON/kode, PDF, Office, gambar via vision, dan ZIP. Untuk ZIP baca daftar dahulu lalu entryPath persis. PDF: pilih page lalu ikuti nextPage; teks: ikuti nextOffset sampai selesai. Jangan menebak isi berdasarkan nama.",
      schema: z.object({ attachmentId: z.string().uuid(), offset: z.number().int().min(0).default(0), page: z.number().int().min(1).optional(), entryPath: z.string().max(1000).optional() }).strict(),
      parameters: objectSchema({ attachmentId: stringField, offset: { type: "integer", minimum: 0 }, entryPath: stringField, page: { type: "integer", minimum: 1 } }, ["attachmentId"]),
      activityMetadata: async (args, run) => {
        const [row] = await deps.db.select().from(attachments).where(and(scope(run), eq(attachments.id, args.attachmentId))).limit(1);
        if (!row) return {};
        const metadata = { attachmentName: row.originalName };
        if (row.sizeBytes > 25_000_000) return metadata;
        const bytes = await deps.readObject(row.objectKey);
        const detected = detectContentKind({ originalName: row.originalName, mimeType: row.contentType, head: bytes.subarray(0, 512) });
        return { ...metadata, attachmentKind: detected.kind };
      },
      execute: async (args, run) => {
        const [row] = await deps.db.select().from(attachments).where(and(scope(run), eq(attachments.id, args.attachmentId))).limit(1);
        if (!row) throw new Error("Lampiran tidak tersedia pada percakapan ini.");
        if (row.sizeBytes > 25_000_000) throw new Error("Lampiran melebihi batas pembacaan 25 MB.");
        return readFileContent({ name: row.originalName, bytes: await deps.readObject(row.objectKey), mime: row.contentType,
          offset: args.offset, page: args.page, entryPath: args.entryPath, describeImage: deps.describeImage ? (image) => deps.describeImage!(image, run) : undefined });
      } }),
  ];
}

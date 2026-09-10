import type { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../../types";
import { attachments } from "../../db/schema";
import { AppError } from "../../lib/errors";
import { requireWorkspace } from "../../middleware/session";
import { requireStorage, type AttachmentRouteDeps } from "./helpers";
import { readFileContent } from "../../services/file-extract/read";

export function registerContentRoutes(routes: Hono<Env>, deps: AttachmentRouteDeps) {
  const query = z.object({ offset: z.coerce.number().int().min(0).default(0), entryPath: z.string().max(1000).optional() });
  routes.get("/files/:attachmentId/content", zValidator("query", query), async (c) => {
    const workspace = requireWorkspace(c);
    const [row] = await deps.db.select().from(attachments).where(and(eq(attachments.id, c.req.param("attachmentId")),
      eq(attachments.userId, workspace.userId), eq(attachments.status, "ready"))).limit(1);
    if (!row) throw new AppError("NOT_FOUND", "Lampiran tidak ditemukan.", 404);
    if (row.sizeBytes > 25_000_000) throw new AppError("FILE_TOO_LARGE", "Batas pratinjau file 25 MB terlampaui.", 413);
    const { body } = await requireStorage(deps).get(row.objectKey);
    try {
      return c.json(await readFileContent({ name: row.originalName, bytes: body, mime: row.contentType, ...c.req.valid("query") }));
    } catch (error) {
      throw new AppError("VALIDATION_FAILED", error instanceof Error ? error.message : "File gagal dibaca.", 422);
    }
  });
}

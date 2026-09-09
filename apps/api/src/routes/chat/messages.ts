import type { Hono } from "hono";
import { and, asc, desc, eq } from "drizzle-orm";
import { AppError } from "../../lib/errors";
import type { Env } from "../../types";
import { agentRuns, messageFeedback, messages } from "../../db/schema";
import { requireConversation, requireWorkspace } from "./helpers";
import type { ChatCtx } from "./types";

/** Baca: pesan, konteks usage, detail run, batal run. */
export function registerMessageRoutes(routes: Hono<Env>, ctx: ChatCtx) {
  const { deps } = ctx;

  routes.get("/api/conversations/:id/messages", async (c) => {
    const workspace = requireWorkspace(c);
    const conv = await requireConversation(ctx, workspace.userId, c.req.param("id"));
    const url = new URL(c.req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 500) || 500, 1), 2000);
    const after = Number(url.searchParams.get("after") ?? 0) || 0;
    const rows = await deps.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(asc(messages.seq))
      .limit(limit + 1);
    const filtered = rows.filter((r) => (r.seq as number) > after).slice(0, limit + 1);
    const hasMore = filtered.length > limit;
    const page = hasMore ? filtered.slice(0, limit) : filtered;
    return c.json({
      messages: page.map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content,
        status: r.status,
        seq: r.seq,
        createdAt: (r.createdAt as Date).toISOString(),
      })),
      nextAfter: hasMore ? page[page.length - 1]!.seq : null,
    });
  });

  routes.get("/api/conversations/:id/context", async (c) => {
    const workspace = requireWorkspace(c);
    const conv = await requireConversation(ctx, workspace.userId, c.req.param("id"));
    const [latestRun] = await deps.db
      .select({ usage: agentRuns.usage, id: agentRuns.id, status: agentRuns.status })
      .from(agentRuns)
      .where(and(eq(agentRuns.conversationId, conv.id), eq(agentRuns.userId, workspace.userId)))
      .orderBy(desc(agentRuns.createdAt))
      .limit(1);
    return c.json({ usage: latestRun?.usage ?? null, runId: latestRun?.id ?? null, status: latestRun?.status ?? null });
  });

  routes.get("/api/runs/:id", async (c) => {
    const workspace = requireWorkspace(c);
    const [row] = await deps.db
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.id, c.req.param("id")), eq(agentRuns.userId, workspace.userId)))
      .limit(1);
    if (!row) throw new AppError("NOT_FOUND", "Run tidak ditemukan.", 404);
    const log = deps.hub.replayUpTo(row.id);
    return c.json({
      run: { id: row.id, status: row.status, conversationId: row.conversationId, usage: row.usage },
      events: log.map((e) => ({ type: e.type, seq: e.seq, payload: e.payload })),
    });
  });

  routes.post("/api/runs/:id/cancel", async (c) => {
    const workspace = requireWorkspace(c);
    const [row] = await deps.db
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.id, c.req.param("id")), eq(agentRuns.userId, workspace.userId)))
      .limit(1);
    if (!row) throw new AppError("NOT_FOUND", "Run tidak ditemukan.", 404);
    deps.loop.cancel(row.id);
    const hasWorker = (deps.loop as unknown as { has?: (id: string) => boolean }).has?.(row.id);
    await deps.db
      .update(agentRuns)
      .set({
        cancelRequested: true,
        ...(!hasWorker ? { status: "cancelled", finishedAt: new Date() } : {}),
      })
      .where(eq(agentRuns.id, row.id));
    return c.json({ ok: true });
  });

  // POST /api/conversations/:id/messages/:msgId/feedback — nilai jawaban AI (1 | -1)
  routes.post("/api/conversations/:id/messages/:msgId/feedback", async (c) => {
    const workspace = requireWorkspace(c);
    const conv = await requireConversation(ctx, workspace.userId, c.req.param("id"));
    const msgId = c.req.param("msgId");
    const body = (await c.req.json().catch(() => null)) as { rating?: unknown } | null;
    const rating = body?.rating === 1 ? 1 : body?.rating === -1 ? -1 : null;
    if (rating === null) throw new AppError("VALIDATION_FAILED", "Rating harus 1 atau -1.", 422);
    const [msg] = await deps.db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.id, msgId), eq(messages.conversationId, conv.id)))
      .limit(1);
    if (!msg) throw new AppError("NOT_FOUND", "Pesan tidak ditemukan.", 404);
    await deps.db.delete(messageFeedback).where(and(eq(messageFeedback.messageId, msgId), eq(messageFeedback.userId, workspace.userId)));
    await deps.db.insert(messageFeedback).values({ userId: workspace.userId, messageId: msgId, conversationId: conv.id, rating });
    return c.json({ ok: true, rating });
  });

  // DELETE — batalkan penilaian
  routes.delete("/api/conversations/:id/messages/:msgId/feedback", async (c) => {
    const workspace = requireWorkspace(c);
    const conv = await requireConversation(ctx, workspace.userId, c.req.param("id"));
    await deps.db.delete(messageFeedback).where(and(eq(messageFeedback.messageId, c.req.param("msgId")), eq(messageFeedback.userId, workspace.userId), eq(messageFeedback.conversationId, conv.id)));
    return c.json({ ok: true });
  });

  // GET — peta penilaian user untuk satu percakapan
  routes.get("/api/conversations/:id/feedback", async (c) => {
    const workspace = requireWorkspace(c);
    const conv = await requireConversation(ctx, workspace.userId, c.req.param("id"));
    const rows = await deps.db
      .select({ messageId: messageFeedback.messageId, rating: messageFeedback.rating })
      .from(messageFeedback)
      .where(and(eq(messageFeedback.conversationId, conv.id), eq(messageFeedback.userId, workspace.userId)));
    return c.json({ feedback: Object.fromEntries(rows.map((r) => [r.messageId, r.rating])) });
  });
}

import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { AppError } from "../../lib/errors";
import type { Env } from "../../types";
import { agentRuns, attachments, conversations } from "../../db/schema";
import { isGreetingOnly } from "../../agent/intent";
import { requireConversation, requireWorkspace } from "./helpers";
import { enforceRunRateLimit } from "./run-registry";
import { executeBackgroundRun } from "./run-executor";
import { buildAttachmentContext, buildAttachmentNote } from "./runs-attachments";
import { resolveEditedMessage } from "./runs-retry";
import { persistUserMessage } from "./runs-persist";
import { RunSchema, type ChatCtx } from "./types";

/** Mulai run: idempoten, persist pesan+run, lalu eksekusi background. */
export function registerRunRoutes(routes: Hono<Env>, ctx: ChatCtx) {
  const { deps, backgroundRuns, runTimesByUser } = ctx;

  routes.post("/api/conversations/:id/runs", zValidator("json", RunSchema), async (c) => {
    const workspace = requireWorkspace(c);
    const conv = await requireConversation(ctx, workspace.userId, c.req.param("id"));
    const input = c.req.valid("json");
    enforceRunRateLimit(runTimesByUser, deps.runRateLimit, workspace.userId);

    // idempotency: same conversation + key returns the existing run
    const [existing] = await deps.db
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.conversationId, conv.id), eq(agentRuns.idempotencyKey, input.idempotencyKey)))
      .limit(1);
    if (existing) {
      return c.json({ runId: existing.id, status: existing.status, resumed: true });
    }

    // one active run per conversation
    const active = await deps.db
      .select({ id: agentRuns.id })
      .from(agentRuns)
      .where(and(eq(agentRuns.conversationId, conv.id), eq(agentRuns.status, "running")))
      .limit(1);
    if (active.length > 0 || [...backgroundRuns.values()].includes(conv.id)) {
      throw new AppError("RUN_ALREADY_ACTIVE", "Satu run aktif per percakapan. Tunggu atau batalkan run berjalan.", 409);
    }

    // Retry in-place: validasi SETELAH guard run-aktif agar penolakan tidak mengubah data.
    const editedMsg = await resolveEditedMessage(deps, conv, input);

    // Resolve the exact selection before persisting or opening any router transaction.
    const cfg = await deps.getProvider(workspace.userId, input.model, input.providerId);
    // attachments: only READY rows owned by this user AND this conversation.
    const wantedIds = editedMsg
      ? (
          await deps.db
            .select({ id: attachments.id })
            .from(attachments)
            .where(
              and(
                eq(attachments.messageId, editedMsg.id),
                eq(attachments.conversationId, conv.id),
                eq(attachments.userId, workspace.userId),
              ),
            )
        ).map((r) => r.id)
      : (input.attachmentIds ?? []);
    const { blocks: attachmentBlocks, visionImages } = await buildAttachmentContext(ctx, {
      userId: workspace.userId,
      conversationId: conv.id,
      wantedIds,
    });
    const attachmentNote = buildAttachmentNote(attachmentBlocks);

    // policy snapshot from the live mode of the active connection
    const connectionId = conv.activeConnectionId;
    let mode: "read-only" | "write" = "read-only";
    let modeVersion = connectionId ? 1 : 0; // 0 = no-router run pinned read-only
    if (connectionId) {
      const live = await deps.connectors.getMode(workspace.userId, connectionId);
      mode = live.mode;
      modeVersion = live.version;
    }
    if (isGreetingOnly(input.text) && wantedIds.length === 0) mode = "read-only";

    const userMessageId = await persistUserMessage(deps, conv, input, editedMsg, attachmentNote, attachmentBlocks, wantedIds);
    const [run] = await deps.db
      .insert(agentRuns)
      .values({
        userId: workspace.userId,
        conversationId: conv.id,
        connectionId: connectionId ?? null,
        idempotencyKey: input.idempotencyKey,
        status: "queued",
        model: input.model ?? null,
      })
      .returning();
    await deps.db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conv.id));

    // background execution — the response returns immediately with runId
    backgroundRuns.set(run!.id, conv.id);
    void executeBackgroundRun(ctx, {
      workspace,
      conv,
      run: run!,
      input,
      cfg,
      userMessageId,
      attachmentNote,
      visionImages,
      connectionId: connectionId ?? null,
      mode,
      modeVersion,
    });

    return c.json({ runId: run!.id, status: run!.status }, 201);
  });
}

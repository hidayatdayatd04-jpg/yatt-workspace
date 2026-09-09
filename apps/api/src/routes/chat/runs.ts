import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, gt, inArray } from "drizzle-orm";
import { AppError } from "../../lib/errors";
import type { Env } from "../../types";
import { agentRuns, attachments, conversations, messages } from "../../db/schema";
import { isGreetingOnly } from "../../agent/intent";
import { requireConversation, requireWorkspace } from "./helpers";
import { enforceRunRateLimit } from "./run-registry";
import { executeBackgroundRun } from "./run-executor";
import { buildAttachmentContext, buildAttachmentNote } from "./runs-attachments";
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

    // Retry in-place: pesan user yang diedit dipakai ulang (tanpa duplikat).
    // Validasi SETELAH guard run-aktif agar penolakan tidak mengubah data.
    let editedMsg: { id: string; seq: number; content: unknown } | null = null;
    if (input.editedMessageId) {
      if ((input.attachmentIds ?? []).length > 0) {
        throw new AppError("VALIDATION_FAILED", "Lampiran baru tidak didukung saat mengulang pesan yang sudah ada.", 422);
      }
      const [row] = await deps.db
        .select({ id: messages.id, seq: messages.seq, content: messages.content, role: messages.role })
        .from(messages)
        .where(and(eq(messages.id, input.editedMessageId), eq(messages.conversationId, conv.id)))
        .limit(1);
      if (!row || row.role !== "user") {
        throw new AppError("VALIDATION_FAILED", "Pesan yang diulang tidak ditemukan atau bukan pesan pengguna.", 422);
      }
      const laterUsers = await deps.db
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.conversationId, conv.id), eq(messages.role, "user"), gt(messages.seq, row.seq as number)))
        .limit(1);
      if (laterUsers.length > 0) {
        throw new AppError(
          "VALIDATION_FAILED",
          "Pesan tersebut sudah memiliki kelanjutan di bawahnya; kirim sebagai pesan baru.",
          409,
        );
      }
      editedMsg = { id: row.id, seq: row.seq as number, content: row.content };
    }

    // Resolve the exact selection before persisting or opening any router transaction.
    const cfg = await deps.getProvider(workspace.userId, input.model, input.providerId);
    // attachments: only READY rows owned by this user AND this conversation.
    // Saat retry in-place, konteks dibangun ulang dari lampiran yang sudah
    // terikat pada pesan tersebut (tanpa upload baru).
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

    // persist input BEFORE streaming starts. Retry in-place: perbarui teks
    // pesan yang sama lalu buang pesan-pesan kedaluwarsa di bawahnya
    // (mis. jawaban gagal) — tanpa menambah pesan user baru.
    let userMessageId: string;
    if (editedMsg) {
      const prevContent =
        editedMsg.content && typeof editedMsg.content === "object"
          ? (editedMsg.content as Record<string, unknown>)
          : {};
      await deps.db
        .update(messages)
        .set({
          content: {
            ...prevContent,
            text: input.text,
            ...(attachmentNote ? { context: attachmentNote } : {}),
            attachments: attachmentBlocks.map((b) => ({ id: b.id, name: b.name, kind: b.kind })),
          },
        })
        .where(eq(messages.id, editedMsg.id));
      await deps.db
        .delete(messages)
        .where(and(eq(messages.conversationId, conv.id), gt(messages.seq, editedMsg.seq)));
      userMessageId = editedMsg.id;
    } else {
      const all = await deps.db
        .select({ seq: messages.seq })
        .from(messages)
        .where(eq(messages.conversationId, conv.id));
      const maxSeq = all.reduce((m, r) => Math.max(m, r.seq), 0);
      const [userMsg] = await deps.db
        .insert(messages)
        .values({ conversationId: conv.id, role: "user", content: { text: input.text, context: attachmentNote || undefined, attachments: attachmentBlocks.map((b) => ({ id: b.id, name: b.name, kind: b.kind })) }, seq: maxSeq + 1 })
        .returning();
      userMessageId = userMsg!.id;
    }
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
    // bind attachments to the persisted user message (post-insert, id known)
    // Retry in-place tidak mengikat ulang (lampiran sudah terikat).
    if (!editedMsg && wantedIds.length > 0) {
      await deps.db.update(attachments).set({ messageId: userMessageId }).where(inArray(attachments.id, wantedIds));
    }
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

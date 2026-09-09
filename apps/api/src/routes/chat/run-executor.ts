import { isReadOnlyIntent } from "../../agent/intent";
import { normalizeReasoningEffort, supportsReasoning, supportsVision } from "@shared/index";
import type { RunEvent } from "../../agent/loop";
import type { WorkspaceContext } from "../../lib/workspace";
import type { ProviderConfigWithKey } from "../../agent/provider-settings";
import type { ChatCtx, ConversationRow, RunInput, RunRow } from "./types";
import { createRunPublisher } from "./run-publish";
import { createEnsureTransaction, createTxBox } from "./run-transaction";
import { resolveRunMode } from "./run-mode";
import { buildRunClient, loadCustomInstructions, loadMemorySummary } from "./run-client";
import { extractMemoriesAsync, loadCrossMemory } from "../../services/user-memory";
import { settleBackgroundRun, type SettleState } from "./run-settle";

/** Eksekusi background satu run: transaksi lazy, client, loop, settlement. */
export async function executeBackgroundRun(
  ctx: ChatCtx,
  args: {
    workspace: WorkspaceContext;
    conv: ConversationRow;
    run: RunRow;
    input: RunInput;
    cfg: ProviderConfigWithKey | null;
    userMessageId: string;
    attachmentNote: string;
    visionImages?: { mime: string; name: string; dataUrl: string }[];
    connectionId: string | null;
    mode: "read-only" | "write";
    modeVersion: number;
  },
): Promise<void> {
  const { deps } = ctx;
  const { workspace, conv, run, input, cfg, connectionId, mode } = args;
  const state: SettleState = { status: "failed", terminalEvent: undefined };
  const box = createTxBox();
  const { publish } = createRunPublisher(ctx, run.id, conv.id, () => box.txId);
  const ensureTransaction = createEnsureTransaction(deps, { userId: workspace.userId, connectionId, runId: run.id }, box);

  try {
    const readOnlyRequested = isReadOnlyIntent(input.text);
    const { conn, effectiveMode, writeBlockNote } = await resolveRunMode(deps, {
      userId: workspace.userId,
      connectionId,
      mode,
      readOnlyRequested,
      box,
    });
    // per-run provider client (real provider bila dikonfigurasi; mock bila belum)
    // Fallback kompatibel (#6) + rate limiter terpusat (#1): primer → cadangan
    // bila primer dibatasi/kuota habis; mode policy tetap read-only/write apa
    // adanya — fallback TIDAK PERNAH mengaktifkan write tools (#8).
    const policyModeForCtx = readOnlyRequested ? "read-only" : mode;
    const client = await buildRunClient(ctx, {
      cfg,
      userId: workspace.userId,
      input,
      runId: run.id,
      conversationId: conv.id,
      policyMode: policyModeForCtx,
    });
    const routerLabel = conn?.status === "connected" ? conn.routerIdentity ?? conn.host : null;
    // Memory summary (untrusted data, never authority): latest compacted context.
    const memorySummary = await loadMemorySummary(ctx, conv.id);
    const crossMemory = await loadCrossMemory(deps.db, workspace.userId).catch(() => null);
    const customInstructions = await loadCustomInstructions(ctx, workspace.userId).catch(() => null);
    // Reasoning hanya diteruskan bila model primer run ini mendukungnya;
    // nilai untuk model biasa diabaikan agar tak membakar request sia-sia.
    const requestedReasoning = normalizeReasoningEffort((input as { reasoningEffort?: unknown }).reasoningEffort);
    const modelForReasoning = input.model ?? cfg?.model ?? "";
    const reasoningEffort = requestedReasoning && supportsReasoning(modelForReasoning) ? requestedReasoning : undefined;
    // Vision: gambar hanya dikirim bila model mendukung vision. Bila tidak,
    // jangan bocor ke provider — model diinstruksikan menjawab jujur agar
    // user ganti ke model vision (konsisten HONESTY_RULES).
    const modelForVision = input.model ?? cfg?.model ?? "";
    const visionSupported = supportsVision(modelForVision);
    const visionImages = visionSupported ? (args.visionImages ?? []) : [];
    const visionBlockedNote =
      (args.visionImages?.length ?? 0) > 0 && !visionSupported
        ? `\n\n[CATATAN SISTEM: pengguna melampirkan ${args.visionImages!.length} gambar, tetapi model "${modelForVision || "saat ini"}" tidak mendukung analisis gambar sehingga gambar TIDAK dikirim ke provider. Jawab jujur: katakan model saat ini tidak mendukung analisis gambar dan minta pengguna ganti ke model vision (mis. Gemini) di pemilih model. Jangan mengarang isi gambar.]`
        : "";
    const result = await deps.loop.run(
      {
        runId: run.id,
        userId: workspace.userId,
        conversationId: conv.id,
        connectionId: connectionId ?? null,
        userMessageId: args.userMessageId,
        userText: input.text + args.attachmentNote + visionBlockedNote,
        visionImages,
        reasoningEffort,
        policy: {
          userId: workspace.userId,
          connectionId: connectionId ?? "none",
          connectionHost: conn?.host ?? undefined,
          managementInterface: (conn as any)?.managementInterface ?? undefined,
          mode: effectiveMode,
          connectorMode: mode,
          runMode: readOnlyRequested ? "read-only" : mode,
          modeVersion: args.modeVersion,
          transactionState: box.txId ? "active" : "none",
        },
        ensureTransaction,
        client,
        executeTool: (call) => {
          if (call.fqName.startsWith("docs:")) {
            return deps.executeDocsTool({ fqName: call.fqName, args: call.args });
          }
          if (call.fqName.startsWith("web:")) {
            return deps.executeWebSearchTool({ userId: workspace.userId, args: call.args });
          }
          if (connectionId && connectionId !== "none") {
            return deps.executeTool({ userId: workspace.userId, connectionId, fqName: call.fqName, args: call.args, retryRead: call.retryRead });
          }
          return Promise.resolve({ ok: false, output: "Tidak ada router aktif pada percakapan ini.", errorCode: "TOOL_UNSUPPORTED" });
        },
        systemInstruction: deps.buildInstruction({
          mode: effectiveMode,
          routerLabel,
          modelLabel: client.modelLabel,
          txActive: box.txId !== null,
          writeBlockNote,
          memorySummary,
          reasoningEffort,
          hasVisionImages: visionImages.length > 0,
          visionSupported,
          crossMemory,
          customInstructions,
          rosVersion: (conn as any)?.rosVersion ?? null,
          boardName: (conn as any)?.boardName ?? null,
          architecture: (conn as any)?.architecture ?? null,
          connectionHost: conn?.host ?? null,
          managementInterface: (conn as any)?.managementInterface ?? null,
        }),
      },
      (e) => {
        if (["run.completed", "run.failed", "run.cancelled"].includes(e.type)) state.terminalEvent = e as RunEvent;
        else publish(e);
        return Promise.resolve();
      },
    );
    state.status = result.status;
    if (result.status === "completed") {
      try {
        const { messages } = await import("../../db/schema");
        const { desc, eq } = await import("drizzle-orm");
        const [last] = await deps.db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(desc(messages.seq))
          .limit(1);
        const content = (last?.role === "assistant" ? (last.content as { text?: string; runId?: string }) : null) ?? null;
        if (content && content.runId === run.id && content.text) {
          extractMemoriesAsync({
            db: deps.db,
            client,
            userId: workspace.userId,
            conversationId: conv.id,
            userText: input.text,
            assistantText: content.text,
          });
        }
      } catch {
        /* ekstraksi non-fatal */
      }
    }
  } catch (err) {
    deps.logger.error("background run crashed", { runId: run.id, message: err instanceof Error ? err.message : String(err) });
  } finally {
    await settleBackgroundRun(ctx, {
      txId: box.txId,
      state,
      runId: run.id,
      conversationId: conv.id,
      userId: workspace.userId,
      publish,
    });
  }
}

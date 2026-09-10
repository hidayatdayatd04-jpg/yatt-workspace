import type { RunEvent } from "../../agent/loop";
import type { WorkspaceContext } from "../../lib/workspace";
import type { ProviderConfigWithKey } from "../../agent/provider-settings";
import type { ChatCtx, ConversationRow, RunInput, RunRow } from "./types";
import { createRunPublisher } from "./run-publish";
import { createEnsureTransaction, createTxBox } from "./run-transaction";
import { prepareRunContext } from "./run-context";
import { extractMemoriesAsync } from "../../services/user-memory";
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
  const { workspace, conv, run, input, connectionId } = args;
  const state: SettleState = { status: "failed", terminalEvent: undefined };
  const box = createTxBox();
  const { publish } = createRunPublisher(ctx, run.id, conv.id, () => box.txId);
  const ensureTransaction = createEnsureTransaction(deps, { userId: workspace.userId, connectionId, runId: run.id }, box);

  try {
    const rc = await prepareRunContext(ctx, { ...args, box });
    const additionalTools = await deps.agentTools?.catalog(workspace.userId) ?? [];
    const result = await deps.loop.run(
      {
        runId: run.id,
        mikrotikEnabled: rc.mikrotikEnabled,
        canUseMikrotik: async () => deps.integrations ? (await deps.integrations.status(workspace.userId, "mikrotik")).enabled : true,
        additionalTools,
        userId: workspace.userId,
        conversationId: conv.id,
        connectionId: connectionId ?? null,
        userMessageId: args.userMessageId,
        userText: input.text + args.attachmentNote + rc.visionCtx.note + (input.attachmentIds?.length ? `\nLampiran untuk tools workspace (attachmentId): ${input.attachmentIds.join(", ")}` : ""),
        visionImages: rc.visionImages,
        reasoningEffort: rc.reasoningEffort,
        policy: {
          userId: workspace.userId,
          connectionId: connectionId ?? "none",
          connectionHost: rc.conn?.host ?? undefined,
          managementInterface: (rc.conn as any)?.managementInterface ?? undefined,
          mode: rc.effectiveMode,
          connectorMode: args.mode,
          runMode: rc.readOnlyRequested ? "read-only" : args.mode,
          modeVersion: args.modeVersion,
          transactionState: box.txId ? "active" : "none",
        },
        ensureTransaction,
        client: rc.client,
        executeTool: async (call, liveRun) => {
          if (call.fqName.startsWith("docs:")) {
            return deps.executeDocsTool({ fqName: call.fqName, args: call.args });
          }
          if (call.fqName.startsWith("web:")) {
            return deps.executeWebSearchTool({ userId: workspace.userId, args: call.args });
          }
          await deps.integrations?.assertAllowed(workspace.userId, "mikrotik");
          const targetId = liveRun?.connectionId ?? connectionId;
          if (targetId && targetId !== "none") {
            return deps.executeTool({ userId: workspace.userId, connectionId: targetId, fqName: call.fqName, args: call.args, retryRead: call.retryRead });
          }
          return Promise.resolve({ ok: false, output: "Tidak ada router aktif pada percakapan ini.", errorCode: "TOOL_UNSUPPORTED" });
        },
        systemInstruction: deps.buildInstruction({
          mikrotikEnabled: rc.mikrotikEnabled,
          mode: rc.effectiveMode,
          routerLabel: rc.routerLabel,
          modelLabel: rc.client.modelLabel,
          txActive: box.txId !== null,
          writeBlockNote: rc.writeBlockNote,
          memorySummary: rc.memorySummary,
          reasoningEffort: rc.reasoningEffort,
          hasVisionImages: rc.visionImages.length > 0,
          visionSupported: rc.visionCtx.visionSupportedForInstruction,
          crossMemory: rc.crossMemory,
          customInstructions: rc.customInstructions,
          rosVersion: (rc.conn as any)?.rosVersion ?? null,
          boardName: (rc.conn as any)?.boardName ?? null,
          architecture: (rc.conn as any)?.architecture ?? null,
          connectionHost: rc.conn?.host ?? null,
          managementInterface: (rc.conn as any)?.managementInterface ?? null,
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
            client: rc.client,
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

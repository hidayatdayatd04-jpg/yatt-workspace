import { resolveRunThinking } from "./run-thinking";
import { isReadOnlyIntent } from "../../agent/intent";
import type { ProviderConfigWithKey } from "../../agent/provider-settings";
import type { WorkspaceContext } from "../../lib/workspace";
import type { ChatCtx, ConversationRow, RunInput, RunRow } from "./types";
import type { TxBox } from "./run-transaction";
import { resolveRunMode } from "./run-mode";
import { buildRunClient, loadCustomInstructions, loadMemorySummary } from "./run-client";
import { loadCrossMemory } from "../../services/user-memory";
import { buildVisionContext } from "./image-reader";

/** Siapkan mode, client provider, memori, reasoning, dan vision untuk satu run. */
export async function prepareRunContext(
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
    box: TxBox;
  },
) {
  const { deps } = ctx;
  const { workspace, conv, run, input, cfg, connectionId, mode, box } = args;
  const mikrotikEnabled = deps.integrations ? (await deps.integrations.status(workspace.userId, "mikrotik")).enabled : true;
  const readOnlyRequested = isReadOnlyIntent(input.text);
  const { conn, effectiveMode, writeBlockNote } = await resolveRunMode(deps, {
    userId: workspace.userId,
    connectionId,
    mode,
    readOnlyRequested,
    box,
  });
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
  const memorySummary = await loadMemorySummary(ctx, conv.id);
  const crossMemory = await loadCrossMemory(deps.db, workspace.userId).catch(() => null);
  const customInstructions = await loadCustomInstructions(ctx, workspace.userId).catch(() => null);
  const { reasoningEffort, customThinking } = resolveRunThinking(input.model ?? cfg?.model ?? "", input.reasoningEffort);
  const visionCtx = await buildVisionContext(ctx, {
    images: args.visionImages ?? [],
    modelForVision: input.model ?? cfg?.model ?? "",
    cfg,
    userId: workspace.userId,
    runId: run.id,
    conversationId: conv.id,
    policyMode: policyModeForCtx,
  });
  return { mikrotikEnabled, readOnlyRequested, conn, effectiveMode, writeBlockNote, policyModeForCtx, client, routerLabel, memorySummary, crossMemory, customInstructions, reasoningEffort, customThinking, visionCtx, visionImages: visionCtx.visionImages };
}

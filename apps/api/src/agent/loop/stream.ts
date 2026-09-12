import { createToolProgressPublisher } from "./stream-tool-progress";
import { createStreamText } from "./stream-text";
import { eq } from "drizzle-orm";
import type { Database } from "../../db";
import { agentRuns } from "../../db/schema";
import type { ChatClient, ChatMessage, ChatToolCall, ChatToolDefinition } from "../chat-client";
import type { EmitFn, RunCounters } from "./context";
import { usageRecordOf } from "./context";

export interface StreamStepEnv {
  db: Database;
  client: ChatClient;
  maxTokens: number;
  runId: string;
  entryController: AbortController;
  /** Diteruskan ke provider sebagai reasoning_effort (undefined = default). */
  reasoningEffort?: import("@shared/index").ReasoningEffort;
  customThinking?: boolean;
}

export type StreamStepOutcome =
  | { status: "timeout" }
  | { status: "ok"; stepText: string; stepToolCalls: ChatToolCall[]; stepFinishReason: string | undefined };

/** Satu giliran stream provider: deadline-guard, akumulasi teks/tool/usage. */
export async function streamStepTurn(
  env: StreamStepEnv,
  args: {
    catalog?: import("../../policies/normalize").NormalizedTool[];
    chatHistory: ChatMessage[];
    providerTools: ChatToolDefinition[];
    greetingOnly: boolean;
    deadline: number;
    finalizationBufferMs: number;
    emitSeq: EmitFn;
    counters: RunCounters;
  },
): Promise<StreamStepOutcome> {
  const { counters: c, emitSeq } = args;
  // Temuan 6: check deadline + finalization buffer (4s for production runs)
  const remainingMs = args.deadline - Date.now();
  if (remainingMs <= 0) {
    c.finalStatus = "failed";
    c.failCode = "RUN_TIMEOUT";
    c.failMessage = "Run melebihi batas waktu server.";
    return { status: "timeout" };
  }
  if (args.finalizationBufferMs > 0 && remainingMs < args.finalizationBufferMs) {
    c.finalStatus = "failed";
    c.failCode = "RUN_TIMEOUT";
    c.failMessage = "Sisa waktu tidak cukup untuk request baru; run difinalisasi lebih awal.";
    return { status: "timeout" };
  }

  const progress = createToolProgressPublisher(args.catalog ?? [], emitSeq);
  const textStream = createStreamText(!!env.customThinking, c, emitSeq);
  let stepToolCalls: ChatToolCall[] = [];
  let stepFinishReason: string | undefined;
  let stepPromptTokens = 0;
  let stepCompletionTokens = 0;
  let stepSawUsage = false;
  // Temuan 6: propagate deadline as AbortSignal to stream request
  const streamTimeoutMs = Math.max(100, remainingMs - args.finalizationBufferMs);
  const deadlineSignal = AbortSignal.timeout(streamTimeoutMs);
  const combinedController = new AbortController();
  const onAbort = () => combinedController.abort();
  env.entryController.signal.addEventListener("abort", onAbort);
  deadlineSignal.addEventListener("abort", onAbort);
  try {
    for await (const ev of env.client.stream({
      messages: args.chatHistory,
      tools: args.providerTools,
      maxTokens: env.maxTokens,
      reasoningEffort: env.reasoningEffort,
      signal: combinedController.signal,
      onRequestAttempt: () => {
        c.aiRequests += 1;
      },
      onQueueWait: (waitedMs) => {
        c.queueMsTotal += Math.max(0, waitedMs);
        c.queueWaits += 1;
        if (waitedMs >= 1500) {
          void emitSeq({ type: "provider.waiting", payload: { waitedMs: Math.round(waitedMs) } });
        }
      },
    })) {
      combinedController.signal.throwIfAborted();
      if (ev.type === "tool_progress" && ev.toolProgress && !args.greetingOnly) {
        await textStream.finish();
        await progress.update(ev.toolProgress);
      } else if (ev.type === "reasoning" && ev.text) {
        // Mode custom: penalaran native (reasoning_content) tidak dibuat blok
        // live agar tidak ada dua blok penalaran. Ia dibuffer dan hanya
        // menjadi SATU blok fallback bila model tidak memakai [[PIKIR]].
        if (env.customThinking) await textStream.nativeReasoning(ev.text);
        else await textStream.reasoning(ev.text);
      } else if (ev.type === "text" && ev.text) {
        await textStream.text(ev.text);
      } else if (ev.type === "tool_calls" && ev.toolCalls) {
        await textStream.finish();
        stepToolCalls = args.greetingOnly ? [] : ev.toolCalls.map(progress.complete);
      } else if (ev.type === "usage" && ev.usage) {
        stepPromptTokens = Math.max(0, ev.usage.promptTokens || 0);
        stepCompletionTokens = Math.max(0, ev.usage.completionTokens || 0);
        stepSawUsage = true;
      } else if (ev.type === "done") {
        stepFinishReason = ev.finishReason;
        break;
      }
    }
    await textStream.finish();
    if (stepSawUsage) {
      c.lastRequestPromptTokens = stepPromptTokens;
      c.lastRequestCompletionTokens = stepCompletionTokens;
      c.promptTokensTotal += stepPromptTokens;
      c.completionTokensTotal += stepCompletionTokens;
      // Transparansi fallback: catat bila jawaban berasal dari model cadangan.
      try {
        const reason = (env.client as unknown as { getFallbackReason?: () => string | null }).getFallbackReason?.() ?? null;
        if (reason && !c.fallbackReason) c.fallbackReason = reason;
      } catch {
        /* non-fatal */
      }
      await env.db.update(agentRuns).set({ usage: usageRecordOf(c, env.client.modelLabel) }).where(eq(agentRuns.id, env.runId));
    }
    return { status: "ok", stepText: textStream.stepText, stepToolCalls, stepFinishReason };
  } catch (err) {
    // Deadline abort mid-stream → timeout, not crash
    if (deadlineSignal.aborted && !env.entryController.signal.aborted) {
      c.finalStatus = "failed";
      c.failCode = "RUN_TIMEOUT";
      c.failMessage = "Deadline tercapai saat menunggu respons provider.";
      return { status: "timeout" };
    }
    throw err;
  } finally {
    env.entryController.signal.removeEventListener("abort", onAbort);
    deadlineSignal.removeEventListener("abort", onAbort);
    await textStream.finish();
  }
}

import type { ChatMessage, ChatToolCall } from "../chat-client";
import type { NormalizedTool } from "../../policies/normalize";
import type { EmitFn, RunCounters } from "./context";
import { executeSingleTool, type SingleToolEnv, type SingleToolState } from "./single-tool";
import { canonicalKey } from "./ranking";
import { parseToolArgs } from "./tool-args";
import type { StartRunInput } from "./types";

export interface StepToolsArgs {
  stepToolCalls: ChatToolCall[];
  catalog: NormalizedTool[];
  chatHistory: ChatMessage[];
  toolCallCount: Map<string, number>;
  deadline: number;
  toolDeadlineBufferMs: number;
  maxToolCalls: number;
  isCancelled: () => boolean;
}

/** Eksekusi seluruh tool call pada satu step (budget, dedup, argumen, loop). */
export async function runStepTools(
  env: SingleToolEnv,
  input: StartRunInput,
  args: StepToolsArgs,
  emitSeq: EmitFn,
  counters: RunCounters,
  state: SingleToolState,
): Promise<void> {
  const { stepToolCalls, catalog, chatHistory, toolCallCount } = args;
  // Map nama provider (kolon dinormalisasi jadi underscore) balik ke fqName
  // katalog. Tool yang tidak ada di katalog tetap dipetakan ke bentuk kolon
  // kanoniknya agar guard TOOL_NOT_OFFERED di dispatch terpicu (bukan jatuh
  // ke gerbang MikroTik yang menyesatkan). Namespace registry tidak pernah
  // mengandung underscore, jadi underscore pertama selalu pemisah namespace.
  const providerNameOf = (call: ChatToolCall) => {
    const mapped = catalog.find((t) => t.fqName.replace(/[^A-Za-z0-9_-]/g, "_") === call.name)?.fqName;
    if (mapped) return mapped;
    const canonical = call.name.replace("_", ":");
    return env.agentTools?.has(canonical) ? canonical : call.name;
  };
  const riskOf = (fq: string) => catalog.find((t) => t.fqName === fq)?.risk ?? "unknown";
  const isBatchableRead = (fq: string) =>
    riskOf(fq) === "read" && fq !== "mikrotik:connect_router" && !fq.includes("find_tools") && !fq.includes("routeros_search");

  interface Batched {
    call: ChatToolCall;
    fq: string;
    parsedArgs: unknown;
    i: number;
  }
  // Pembacaan independen yang berurutan dieksekusi PARALEL (satu batch =
  // satu Promise.all); mutasi/discovery tetap serial demi urutan Safe Mode.
  let readBatch: Batched[] = [];
  const flushReads = async (): Promise<void> => {
    if (readBatch.length === 0) return;
    const batch = readBatch;
    readBatch = [];
    if (batch.length === 1 || hasDuplicateLoopKey(batch)) {
      for (const b of batch) {
        await executeSingleTool(env, input, b.call, b.fq, b.parsedArgs, catalog, b.i, emitSeq, counters, state, chatHistory);
        if (counters.finalStatus !== "completed") break;
      }
      return;
    }
    await Promise.all(
      batch.map((b) => executeSingleTool(env, input, b.call, b.fq, b.parsedArgs, catalog, b.i, emitSeq, counters, state, chatHistory)),
    );
  };
  const hasDuplicateLoopKey = (batch: Batched[]): boolean => {
    const seen = new Set<string>();
    for (const b of batch) {
      const k = canonicalKey(b.fq, b.parsedArgs);
      if (seen.has(k)) return true;
      seen.add(k);
    }
    return false;
  };

  for (const [i, call] of stepToolCalls.entries()) {
    if (args.isCancelled()) {
      counters.finalStatus = "cancelled";
      break;
    }
    // Temuan 6: check deadline before each tool execution
    if (Date.now() > args.deadline - args.toolDeadlineBufferMs) {
      counters.finalStatus = "failed";
      counters.failCode = "RUN_TIMEOUT";
      counters.failMessage = "Deadline tercapai sebelum tool berikutnya dapat dieksekusi.";
      break;
    }
    if (counters.toolCallsTotal >= args.maxToolCalls) {
      counters.finalStatus = "failed";
      counters.failCode = "TOOL_CALL_BUDGET";
      counters.failMessage = `Batas ${args.maxToolCalls} tool call per run tercapai.`;
      break;
    }
    counters.toolCallsTotal += 1;
    if (toolCallCount.has(call.id)) {
      // dedup repeated ids: still answer with a tool message to keep
      // the provider's required assistant(tool_calls) → tool alternation
      chatHistory.push({ role: "tool", content: JSON.stringify({ error: "DUPLICATE_CALL", message: "Panggilan duplikat diabaikan." }), toolCallId: call.id });
      continue;
    }
    toolCallCount.set(call.id, 1);
    // WAIT for complete arguments: parse JSON; incomplete → typed error result, never executed
    const parsed = await parseToolArgs(env.db, input, call, chatHistory);
    if (!parsed.ok) {
      // Emit penyelesaian agar kartu aktivitas tool.preparing tidak menggantung
      // dalam status "running" (VALIDATION_FAILED tidak pernah dieksekusi).
      await emitSeq({ type: "tool.failed", payload: { callId: call.id, name: call.name,
        code: "VALIDATION_FAILED", summary: "Argumen tool bukan JSON lengkap — tidak dieksekusi.", durationMs: 0 } });
      continue;
    }
    // map provider tool name back to fqName (dots replaced by _ in provider space)
    const fq = providerNameOf(call);
    if (isBatchableRead(fq)) {
      readBatch.push({ call, fq, parsedArgs: parsed.args, i });
      continue;
    }
    await flushReads();
    if (counters.finalStatus !== "completed") break;
    await executeSingleTool(env, input, call, fq, parsed.args, catalog, i, emitSeq, counters, state, chatHistory);
    if (counters.finalStatus !== "completed") break;
  }
  await flushReads();
}

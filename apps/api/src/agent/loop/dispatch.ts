import type { Database } from "../../db";
import { toolExecutions } from "../../db/schema";
import { AppError } from "../../lib/errors";
import { redactObject } from "../../lib/redaction";
import type { ChatToolCall } from "../chat-client";
import type { PolicyDispatcher } from "../../policies/dispatcher";
import type { NormalizedTool } from "../../policies/normalize";
import type { EmitFn, ToolMsg } from "./context";
import { policyDenialGuidance } from "./guidance";
import { rejectUnreferencedPath, type DispatchOutcomeDenied } from "./dispatch-peek";
import type { StartRunInput } from "./types";

export interface ToolEnv {
  agentTools?: import("../../tools/registry").AgentToolRegistry;
  toolSignal?: AbortSignal;
  db: Database;
  dispatcher: PolicyDispatcher;
}

export type DispatchOutcome =
  | { allowed: true; tool: NormalizedTool }
  | { allowed: false; toolMsg: ToolMsg };

/** Penolakan typed + catat DB + emit tool.failed. */
async function deny(
  env: ToolEnv,
  input: StartRunInput,
  call: ChatToolCall,
  fqName: string,
  args: unknown,
  emit: EmitFn,
  started: number,
  code: string,
  message: string,
  guidance?: string,
): Promise<DispatchOutcomeDenied> {
  await env.db.insert(toolExecutions).values({ runId: input.runId, toolCallId: call.id, toolName: fqName, risk: "unknown", sanitizedInput: redactObject(args ?? {}), resultSummary: null, status: "denied", errorCode: code, durationMs: Date.now() - started }).onConflictDoNothing();
  await emit({ type: "tool.failed", payload: { callId: call.id, name: fqName, code, message, durationMs: Date.now() - started } });
  return {
    allowed: false,
    toolMsg: { role: "tool", content: JSON.stringify({ ok: false, error: code, message, ...(guidance ? { guidance } : {}) }), toolCallId: call.id, note: `Tool ${fqName} ditolak (${code}): ${message}`.slice(0, 500), ok: false, errorCode: code, risk: "unknown" },
  };
}

/**
 * Deferred transaction opening + policy dispatch + pencatatan denial.
 * Mengembalikan tool terotorisasi, atau pesan tool penolakan typed.
 */
export async function dispatchToolCall(
  env: ToolEnv,
  input: StartRunInput,
  call: ChatToolCall,
  fqName: string,
  args: unknown,
  catalog: NormalizedTool[],
  emit: EmitFn,
  started: number,
): Promise<DispatchOutcome> {
  const peek = await rejectUnreferencedPath(env.db, input, call, fqName, args, emit, started);
  if (peek) return peek;
  const toolInCatalog = catalog.find((t) => t.fqName === fqName);
  const isRegistryTool = !!env.agentTools?.has(fqName);
  // General/integration tools use their own live permission checks in the registry.
  // They never enter the MikroTik transaction dispatcher.
  if (toolInCatalog && isRegistryTool) return { allowed: true, tool: toolInCatalog };
  // Registry tool sengaja tidak ditawarkan run ini (filter anti-intip/sapaan):
  // tolak typed — JANGAN jatuh ke gerbang MikroTik yang menyesatkan.
  if (isRegistryTool && !toolInCatalog) {
    return deny(env, input, call, fqName, args, emit, started, "TOOL_NOT_OFFERED",
      `Tool ${fqName} tidak ditawarkan untuk percakapan ini.`,
      "Jangan menebak isi workspace. Tanyakan kepada pengguna file/kebutuhan mana yang dimaksud, atau minta file dilampirkan.");
  }
  // Router tools (mikrotik/custom) fall through to the transaction dispatcher.
  const isRouterTool = !fqName.startsWith("docs:") && !fqName.startsWith("web:");
  const routerDisabled = isRouterTool && (input.mikrotikEnabled === false || input.canUseMikrotik && !(await input.canUseMikrotik()));
  if (!routerDisabled && input.policy.mode === "write" && input.policy.transactionState !== "active" && toolInCatalog && toolInCatalog.risk !== "read" && input.ensureTransaction) {
    const txRes = await input.ensureTransaction();
    if (txRes.ok && txRes.transactionId) {
      input.policy.transactionState = "active";
      await emit({
        type: "transaction.updated",
        payload: { transactionId: txRes.transactionId, state: "active", actions: 0 },
      });
    }
  }

  let decision: Awaited<ReturnType<PolicyDispatcher["check"]>>;
  try {
    if (routerDisabled) throw new AppError("FORBIDDEN", "MikroTik Server nonaktif. Aktifkan melalui menu chat atau Connectors.", 403);
    decision = await env.dispatcher.check({
      workspace: { userId: input.userId },
      snapshot: { ...input.policy },
      toolFqName: fqName,
      args,
    });
  } catch (err) {
    // mode/ownership probes throwing must surface as a typed tool denial,
    // never crash the run (e.g. no router bound to the conversation)
    const code = err instanceof AppError ? err.code : "INTERNAL_ERROR";
    const message = err instanceof AppError ? err.message : "Pemeriksaan policy gagal.";
    return deny(env, input, call, fqName, args, emit, started, code, message);
  }
  if (!decision.allowed) {
    const guidance = policyDenialGuidance(decision.code, fqName);
    return deny(env, input, call, fqName, args, emit, started, decision.code, decision.message, guidance);
  }
  return { allowed: true, tool: decision.tool };
}

import type { Database } from "../../db";
import type { Logger } from "../../lib/logger";
import type { ChatClient } from "../chat-client";
import type { PolicyDispatcher, PolicySnapshot } from "../../policies/dispatcher";
import type { TransactionCoordinator } from "../../transactions/coordinator";
import type { NormalizedTool } from "../../policies/normalize";
import type { ReasoningEffort } from "@shared/index";
import type { WorkspaceScope } from "./workspace-scope";

export interface RunEvent {
  type:
    | "run.started"
    | "message.delta"
    | "reasoning.delta"
    | "tool.preparing"
    | "tool.started"
    | "tool.completed"
    | "tool.failed"
    | "transaction.updated"
    | "provider.waiting"
    | "run.completed"
    | "run.failed"
    | "run.cancelled";
  seq: number;
  runId: string;
  payload: Record<string, unknown>;
}

export interface AgentRunDeps {
  agentTools?: import("../../tools/registry").AgentToolRegistry;
  db: Database;
  logger: Logger;
  dispatcher: PolicyDispatcher;
  txCoordinator: TransactionCoordinator;
  catalog: { getCatalog(mode: "read-only" | "write"): Promise<NormalizedTool[]> };
  limits: { maxSteps: number; maxToolCalls: number; runTimeoutMs: number; maxTokens: number };
}

export interface StartRunInput {
  mikrotikEnabled?: boolean;
  canUseMikrotik?: () => Promise<boolean>;
  additionalTools?: NormalizedTool[];
  runId: string;
  userId: string;
  conversationId: string;
  connectionId: string | null;
  userMessageId: string;
  userText: string;
  /**
   * Gambar vision untuk pesan user saat ini (data URI base64). Diisi dari
   * lampiran gambar yang sudah tervalidasi; dikirim ke provider hanya bila
   * model mendukung vision (difilter di run-executor).
   */
  visionImages?: { mime: string; name: string; dataUrl: string }[];
  policy: PolicySnapshot;
  /** Per-run provider client (user-configured provider or mock). */
  client: ChatClient;
  /** Executes a dispatched tool on the user's MCP child; backend-owned. */
  executeTool: (input: { fqName: string; args: unknown; retryRead?: boolean }, run?: StartRunInput) => Promise<{ ok: boolean; output: string; errorCode?: string }>;
  /** System instruction with mode/router/doc rules for this run. */
  systemInstruction: string;
  /**
   * Upaya penalaran pilihan pengguna untuk run ini (diteruskan ke provider
   * sebagai `reasoning_effort`; undefined = default model).
   */
  reasoningEffort?: ReasoningEffort;
  customThinking?: boolean;
  /** Lazily opens Safe Mode transaction only when a mutation is about to run */
  ensureTransaction?: () => Promise<{ ok: boolean; transactionId?: string; error?: string }>;
  /** Cakupan workspace percakapan (diisi loop sebelum katalog): browse terkunci bila false. */
  workspaceScope?: WorkspaceScope;
}

export const MAX_TOOL_RESULT_CHARS = 8_000;

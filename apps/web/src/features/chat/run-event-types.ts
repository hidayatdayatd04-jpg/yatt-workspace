import type { Dispatch, SetStateAction } from "react";
import type { RunEventDTO } from "./chat-hooks";
import type { ToolActivityMetadata } from "./tool-activity/types";

export interface LiveToolItem extends ToolActivityMetadata {
  id: string;
  name: string;
  status: "running" | "done" | "failed";
  args?: string;
}

/** Error run yang ditangkap live dari event run.failed (kartu, bukan chat). */
export interface LiveRunError {
  runId: string;
  code: string;
  reason: string;
  toolSucceeded: number;
  toolFailed: number;
}

export const TERMINAL = ["completed", "failed", "cancelled"];

export const STREAM_EVENT_TYPES = [
  "run.started",
  "message.delta",
  "reasoning.delta",
  "tool.preparing",
  "tool.started",
  "tool.completed",
  "tool.failed",
  "transaction.updated",
  "provider.waiting",
  "run.completed",
  "run.failed",
  "run.cancelled",
] as const;

export interface RunEventsSink {
  setEvents: Dispatch<SetStateAction<RunEventDTO[]>>;
  setStreamText: Dispatch<SetStateAction<string>>;
  setReasoningText: Dispatch<SetStateAction<string>>;
  setToolActivity: Dispatch<SetStateAction<LiveToolItem[]>>;
  setTxStatus: Dispatch<SetStateAction<string | null>>;
  setQueueStatus: Dispatch<SetStateAction<string | null>>;
  setLive: Dispatch<SetStateAction<boolean>>;
  setRunError: Dispatch<SetStateAction<LiveRunError | null>>;
}

import type { PipelineStep, StepStatus } from "../tool-activity/types";

export type ToolCardStatus = "pending" | "running" | "success" | "error" | "cancelled";

export interface ToolExecution {
  id: string;
  toolName: string;
  displayName: string;
  icon?: string;
  status: ToolCardStatus;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number | null;
  input?: unknown;
  output?: unknown;
  preview?: unknown;
  error?: {
    code?: string;
    message: string;
    details?: unknown;
  };
}

/** Detail dari GET /api/runs/:runId/tools/:callId (sudah ter-redact dua lapis). */
export interface ToolExecutionDetail {
  toolName: string;
  status: string;
  input: unknown;
  output: string;
  errorCode?: string | null;
  durationMs?: number | null;
  startedAt?: number;
}

export const STATUS_LABEL: Record<ToolCardStatus, string> = {
  pending: "Menunggu",
  running: "Menjalankan…",
  success: "Selesai",
  error: "Gagal",
  cancelled: "Dibatalkan",
};

/** Mapping StepStatus pipeline lama → status Tool Card. */
function cardStatus(status: StepStatus): ToolCardStatus {
  switch (status) {
    case "running": return "running";
    case "completed": return "success";
    case "failed": return "error";
    // Run berakhir tanpa completion — paling umum karena dibatalkan.
    case "unknown": return "cancelled";
  }
}

export function stepToCard(step: PipelineStep): ToolExecution {
  const status = cardStatus(step.status);
  return {
    id: step.key,
    toolName: step.tool,
    displayName: step.activityLabel || step.label,
    status,
    durationMs: step.durationMs,
    input: step.args,
    output: step.summary,
    ...(step.code && status === "error" ? { error: { code: step.code, message: step.summary ?? "" } } : {}),
  };
}

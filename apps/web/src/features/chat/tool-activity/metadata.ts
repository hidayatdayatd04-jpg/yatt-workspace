import type { ToolActivityMetadata } from "./types";

/** Ambil hanya metadata tampilan yang dikenal dari event live atau riwayat. */
export function activityMetadata(payload: Record<string, unknown>): ToolActivityMetadata {
  return {
    ...(typeof payload.activityLabel === "string" && payload.activityLabel.trim() ? { activityLabel: payload.activityLabel.trim().slice(0, 120) } : {}),
    ...(typeof payload.attachmentName === "string" ? { attachmentName: payload.attachmentName } : {}),
    ...(typeof payload.attachmentKind === "string" ? { attachmentKind: payload.attachmentKind } : {}),
  };
}

export function activityArgs(payload: Record<string, unknown>): string | undefined {
  return typeof payload.args === "string" && payload.args ? payload.args : undefined;
}

export function activityTool(payload: Record<string, unknown>): string {
  return String(payload.tool ?? payload.name ?? "tool");
}

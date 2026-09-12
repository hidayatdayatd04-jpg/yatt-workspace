import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, TriangleAlertIcon } from "@/components/icons";
import { formatDuration } from "../tool-activity/humanize";
import type { PipelineStep, RunOverall } from "../tool-activity/types";
import { pipelineStatus } from "../tool-activity/build";
import { stepToCard, type ToolCardStatus } from "./types";
import { ToolCard } from "./ToolCard";

type GroupStatus = ToolCardStatus | "done";

function groupStatusOf(steps: PipelineStep[], live: boolean, overall: RunOverall): GroupStatus {
  if (live) {
    const running = steps.some((s) => s.status === "running");
    return running ? "running" : "pending";
  }
  if (overall === "cancelled") return "cancelled";
  if (steps.some((s) => s.status === "failed")) return "error";
  if (steps.some((s) => s.status === "unknown")) return "cancelled";
  return "success";
}

function HeadIcon(props: { status: GroupStatus }) {
  if (props.status === "running") return <Loader2 className="size-3.5 shrink-0 animate-spin text-indigo-500 motion-reduce:animate-none" />;
  if (props.status === "error") return <TriangleAlertIcon className="size-3.5 shrink-0 text-destructive" />;
  return <span className={`size-3.5 shrink-0 ${props.status === "success" ? "text-emerald-500" : "text-muted-foreground"}`} aria-hidden />;
}

/** Shell grup multi-tool: header ringkas + daftar ToolCard vertikal. */
export function ToolGroup(props: {
  steps: PipelineStep[];
  runId?: string;
  live?: boolean;
  overall?: RunOverall;
  onRetry?: () => void;
  headerRight?: React.ReactNode;
}) {
  const [open, setOpen] = useState(props.steps.length <= 1);
  const status = pipelineStatus(props.steps);
  const groupStatus = groupStatusOf(props.steps, !!props.live, props.overall ?? null);
  const totalMs = props.steps.reduce((n, s) => n + (typeof s.durationMs === "number" ? s.durationMs : 0), 0);
  const totalLabel = totalMs > 0 ? formatDuration(totalMs) : null;
  const failed = props.steps.filter((s) => s.status === "failed").length;
  const label = props.steps.length === 1
    ? props.steps[0]!.label
    : `Proses · ${props.steps.length} langkah${failed > 0 ? ` · ${failed} gagal` : ""}`;
  const single = props.steps.length === 1;

  return (
    <div className="space-y-1.5">
      {single ? (
        <ToolCard
          execution={stepToCard(props.steps[0]!)}
          runId={props.runId}
          callId={props.steps[0]!.callId}
          onRetry={props.onRetry}
          live={props.live && props.steps[0]!.status === "running"}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-2 text-left text-xs hover:text-foreground"
            aria-expanded={open}
          >
            <span className="flex min-w-0 items-center gap-2 font-medium text-muted-foreground">
              <HeadIcon status={groupStatus} />
              <span className={`truncate motion-reduce:animate-none ${status === "running" ? "animate-pulse" : ""}`} title={label}>
                {label}
              </span>
              {open ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
              {props.headerRight}
              {totalLabel && <span title="Waktu persiapan oleh AI dan eksekusi tool.">{totalLabel}</span>}
              <span className="sr-only">{groupStatus === "success" ? "Selesai" : status === "running" ? "Berjalan" : groupStatus === "error" ? "Gagal" : ""}</span>
            </span>
          </button>
          {open && (
            <ol className="space-y-1.5 animate-in fade-in-50 duration-200">
              {props.steps.map((step) => (
                <li key={step.key}>
                  <ToolCard
                    execution={stepToCard(step)}
                    runId={props.runId}
                    callId={step.callId}
                    onRetry={props.onRetry}
                    live={props.live && step.status === "running"}
                  />
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

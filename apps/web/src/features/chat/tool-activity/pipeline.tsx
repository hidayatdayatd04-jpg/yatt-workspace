import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Loader2, Clock, TriangleAlertIcon } from "@/components/icons";
import type { PipelineStep, PipelineTx, StepStatus, RunOverall } from "./types";
import { formatDuration } from "./humanize";
import { pipelineStatus, runPipelineHeadline } from "./build";
import { toolIcon } from "./tool-icons";

const STATUS_LABEL: Record<StepStatus, string> = {
  running: "Berjalan",
  completed: "Selesai",
  failed: "Gagal",
  unknown: "Tak diketahui",
};

/** Ikon per jenis tool (bukan centang generik); kegagalan pakai ikon peringatan. */
function ToolStatusIcon(props: { tool: string; status: StepStatus }) {
  const Icon = toolIcon(props.tool);
  if (props.status === "failed") return <TriangleAlertIcon className="size-3.5 shrink-0 text-destructive" />;
  if (props.status === "unknown") return <Clock className="size-3.5 shrink-0 text-muted-foreground" />;
  const running = props.status === "running";
  return <Icon className={`size-3.5 shrink-0 motion-reduce:animate-none ${running ? "animate-pulse text-indigo-500" : "text-emerald-500"}`} />;
}

export function RunPipeline(props: {
  steps: PipelineStep[];
  tx?: PipelineTx[];
  defaultOpen?: boolean;
  headerRight?: ReactNode;
  expandedContent?: ReactNode;
  live?: boolean;
  /** Live menunggu output AI berikutnya — label tool terakhir tetap berkedip. */
  waiting?: boolean;
  /** Status akhir run; bila failed/cancelled, headline tidak boleh "Selesai". */
  overall?: RunOverall;
}) {
  const [open, setOpen] = useState(!!props.defaultOpen);
  const status = props.live ? ("running" as const) : pipelineStatus(props.steps);
  const totalMs = props.steps.reduce((n, s) => n + (typeof s.durationMs === "number" ? s.durationMs : 0), 0);
  const totalLabel = totalMs > 0 ? formatDuration(totalMs) : null;
  const failed = props.steps.filter((s) => s.status === "failed").length;
  const headline = runPipelineHeadline({
    stepsCount: props.steps.length,
    txCount: props.tx?.length ?? 0,
    failedSteps: failed,
    live: props.live,
    overall: props.overall ?? null,
    steps: props.steps,
  });
  const pulsing = status === "running" || !!props.waiting;
  const headTool = props.steps[0]?.tool ?? "";
  const headTone: StepStatus = failed > 0 ? "failed" : status === "done" ? "completed" : status;
  // Pipeline tool biasa: baris tunggal non-interaktif — tanpa daftar langkah
  // terpisah di bawahnya (cukup satu baris label per kartu tool).
  if (!props.expandedContent) {
    return (
      <div className="min-w-0 text-muted-foreground">
        <div className="flex w-full items-center justify-between gap-2 px-1 py-2 text-left text-xs">
          <span className="flex min-w-0 items-center gap-2 font-medium">
            {headTool
              ? <ToolStatusIcon tool={headTool} status={headTone} />
              : <Loader2 className={`size-3.5 shrink-0 text-indigo-500 motion-reduce:animate-none ${status === "running" ? "animate-spin" : ""}`} />}
            <span className={`truncate motion-reduce:animate-none ${pulsing ? "animate-pulse" : ""}`} title={headline.text}>{headline.text}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
            {props.headerRight}
            {totalLabel && <span title="Waktu persiapan oleh AI dan eksekusi tool; animasi pengetikan tidak dihitung.">{totalLabel}</span>}
            <span className="sr-only">{status === "done" ? "Selesai" : STATUS_LABEL[status]}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-2 text-left text-xs hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        aria-expanded={open}
        aria-label={`${headline.text}. ${open ? "Tutup detail" : "Buka detail"}`}
      >
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <ToolStatusIcon tool={headTool} status={headTone} />
          <span className={`truncate motion-reduce:animate-none ${pulsing ? "animate-pulse" : ""}`} title={headline.text}>{headline.text}</span>
          {open ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
          {props.headerRight}
          {totalLabel && <span title="Waktu persiapan oleh AI dan eksekusi tool; animasi pengetikan tidak dihitung.">{totalLabel}</span>}
          <span className="sr-only">{status === "done" ? "Selesai" : STATUS_LABEL[status]}</span>
        </span>
      </button>
      {open && (
        <ol className="mt-1 divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
          <li className="space-y-1.5 px-3 py-2.5">{props.expandedContent}</li>
        </ol>
      )}
    </div>
  );
}

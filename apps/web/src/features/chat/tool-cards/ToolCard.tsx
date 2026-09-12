import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, TriangleAlertIcon } from "@/components/icons";
import { formatDuration } from "../tool-activity/humanize";
import { STATUS_LABEL, type ToolExecution } from "./types";
import { cardIcon, toolMetadata } from "./registry";
import { ToolPreview } from "./preview";
import { JsonView } from "./json-view";
import { useToolDetail } from "./use-tool-detail";
import { redactSecrets } from "./secret-redact";

function statusIconClass(status: ToolExecution["status"]): string {
  switch (status) {
    case "success": return "text-emerald-500";
    case "error": return "text-destructive";
    case "running": return "animate-pulse text-indigo-500 motion-reduce:animate-none";
    default: return "text-muted-foreground";
  }
}

function StatusBadge(props: { status: ToolExecution["status"] }) {
  const { status } = props;
  if (status === "success") return <Check className="size-3.5 shrink-0 text-emerald-500" />;
  if (status === "error") return <TriangleAlertIcon className="size-3.5 shrink-0 text-destructive" />;
  if (status === "running") return <Loader2 className="size-3.5 shrink-0 animate-spin text-indigo-500 motion-reduce:animate-none" />;
  return <span className="size-3.5 shrink-0" aria-hidden />;
}

const chipClass = "rounded-lg border border-border/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground";

/** LEVEL 1 compact → LEVEL 2 readable (input/preview/retry) → LEVEL 3 raw JSON. */
export function ToolCard(props: {
  execution: ToolExecution;
  runId?: string;
  callId?: string;
  onRetry?: () => void;
  live?: boolean;
  defaultOpen?: boolean;
}) {
  const { execution } = props;
  const [open, setOpen] = useState(!!props.defaultOpen);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const Icon = cardIcon(execution.toolName);
  const category = toolMetadata(execution.toolName).category;
  const detail = useToolDetail(props.runId, props.callId, open && !props.live);
  const output = detail.data?.output ?? (typeof execution.output === "string" ? execution.output : undefined);
  const duration = formatDuration(execution.durationMs ?? null);

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(redactSecrets(output ?? ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard tidak tersedia */
    }
  };

  return (
    <div className={`overflow-hidden rounded-xl border transition-colors ${
      execution.status === "error"
        ? "border-rose-500/30 bg-rose-500/[0.07] dark:bg-rose-500/[0.1]"
        : "border-border/70 bg-card/60"
    }`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
          <Icon className={`size-3.5 shrink-0 ${statusIconClass(execution.status)}`} />
          <span className="truncate" title={execution.displayName}>{execution.displayName}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
          <span className="sr-only">{STATUS_LABEL[execution.status]}</span>
          {duration && <span>{duration}</span>}
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border/60 bg-muted/10 px-3 py-2.5 animate-in fade-in-50 duration-200">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <StatusBadge status={execution.status} />
            <span className="font-medium text-muted-foreground">{STATUS_LABEL[execution.status]}</span>
            {execution.error?.code && (
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] text-rose-600 dark:text-rose-400">
                {execution.error.code}
              </span>
            )}
          </div>
          {typeof execution.input === "string" && execution.input && execution.input !== "{}" && (
            <div>
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">Input</p>
              <pre className="overflow-auto rounded-lg border border-border/60 bg-background/70 p-2 font-mono text-[11px] leading-relaxed">
                {redactSecrets(execution.input)}
              </pre>
            </div>
          )}
          {execution.status === "error" ? (
            <div>
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">Pesan error</p>
              <p className="whitespace-pre-wrap rounded-lg border border-rose-500/30 bg-rose-500/[0.07] p-2 text-xs leading-relaxed">
                {redactSecrets(output ?? execution.error?.message ?? "Tool gagal dijalankan.")}
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">Hasil</p>
              <ToolPreview category={category} output={output} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={copyOutput} className={chipClass}>
              {copied ? "Tersalin" : "Salin output"}
            </button>
            <button type="button" onClick={() => setShowRaw((v) => !v)} className={chipClass}>
              {showRaw ? "Tutup raw" : "Raw JSON"}
            </button>
            {execution.status === "error" && props.onRetry && (
              <button
                type="button"
                onClick={props.onRetry}
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
              >
                Coba lagi
              </button>
            )}
          </div>
          {showRaw && (
            output
              ? <JsonView value={output} />
              : <p className="text-[11px] text-muted-foreground">
                  Raw output belum tersedia{props.live ? " (sedang berjalan)" : "."}
                </p>
          )}
          {detail.isError && !props.live && (
            <p className="text-[11px] text-muted-foreground">Detail lengkap tidak tersedia — menampilkan ringkasan event.</p>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Brain, ChevronDown } from "@/components/icons";

const MARKER_RE = /\[\[\/?PIKIR\]\]/g;

export function ReasoningBlock(props: { text: string; live: boolean; active?: boolean; durationMs?: number }) {
  const [open, setOpen] = useState(props.live);
  const [duration, setDuration] = useState(0);
  const live = props.live && props.active !== false;
  const finalSeconds = typeof props.durationMs === "number" ? Math.max(0, Math.round(props.durationMs / 1000)) : undefined;
  // Durasi final tidak boleh "mundur" dari hitungan live yang sudah tampil,
  // dan durasi < 1 detik tidak ditampilkan (blok sekejap bukan "0 dtk").
  const [maxLive, setMaxLive] = useState(0);
  useEffect(() => {
    if (duration > maxLive) setMaxLive(duration);
  }, [duration, maxLive]);
  const seconds = finalSeconds === undefined ? duration : Math.max(finalSeconds, maxLive);
  const showDuration = live || seconds >= 1;
  const durationLabel = seconds >= 1 ? ` ${seconds} dtk` : "";
  useEffect(() => {
    if (!live) setOpen(false);
  }, [live]);
  useEffect(() => {
    if (!live) return;
    const started = Date.now();
    const id = setInterval(() => setDuration(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [live]);
  const text = props.text.replace(MARKER_RE, "");
  if (!text) return null;
  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-border/60 bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
        {live
          ? <span className="flex items-center gap-1.5">
              <Brain className={`size-3.5 text-indigo-500 ${props.active === false ? "" : "animate-pulse"}`} aria-hidden="true" />
              Berpikir{durationLabel ? ` selama${durationLabel}` : "…"}
            </span>
          : <span className="flex items-center gap-1.5">
              <Brain className="size-3.5" aria-hidden="true" />
              Proses berpikir{showDuration && durationLabel ? ` ·${durationLabel.replace(" ", " ")}` : ""}
            </span>}
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto border-t border-border/50 px-3 py-2">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{text}</p>
        </div>
      )}
    </div>
  );
}

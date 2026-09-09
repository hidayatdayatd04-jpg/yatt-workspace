import { useEffect, useState } from "react";
import { ChevronDown } from "@/components/icons";

export function ReasoningBlock(props: { text: string; live: boolean }) {
  const [open, setOpen] = useState(props.live);
  useEffect(() => {
    if (!props.live) setOpen(false);
  }, [props.live]);
  if (!props.text) return null;
  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-border/60 bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
        {props.live ? "Sedang berpikir…" : "Proses berpikir"}
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto border-t border-border/50 px-3 py-2">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{props.text}</p>
        </div>
      )}
    </div>
  );
}

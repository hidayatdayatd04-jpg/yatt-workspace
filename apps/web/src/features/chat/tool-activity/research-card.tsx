import { Globe, ExternalLink } from "@/components/icons";
import type { ResearchResult } from "@shared/index";
import { RunPipeline } from "./pipeline";
import { humanizeTool } from "./humanize";

/** Hasil riset memakai disclosure yang sama; tautan sumber tetap tersedia. */
export function ResearchCard(props: { activityLabel?: string; research: ResearchResult | null; status: "running" | "completed" | "failed" }) {
  const research = props.research;
  const sources = research?.sources ?? [];
  const domainOf = (url: string) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return url; }
  };
  const args = research?.query ? JSON.stringify({ query: research.query }) : undefined;
  return (
    <RunPipeline
      steps={[{ key: "research", index: 1, tool: "web:search", label: humanizeTool("web:search", args, { activityLabel: props.activityLabel }),
        status: props.status, args, summary: research ? JSON.stringify(research, null, 2) : undefined }]}
      live={props.status === "running"}
      headerRight={props.status === "completed" ? `${sources.length} sumber` : undefined}
      expandedContent={<>
          {props.status === "failed" && <p className="text-xs text-destructive">Pencarian web gagal dijalankan.</p>}
          {props.status === "running" && sources.length === 0 && (
            <p className="text-xs text-muted-foreground">Mencari informasi terkini di internet…</p>
          )}
          {research?.answer && (
            <p className="rounded-lg bg-background/70 px-2.5 py-2 text-xs leading-relaxed text-foreground/90">{research.answer}</p>
          )}
          {sources.map((s, i) => (
            <a
              key={`${s.url}-${i}`}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-border/60 bg-background/70 px-2.5 py-2 transition-colors hover:border-indigo-500/40 hover:bg-background"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-md bg-indigo-500/15 text-[10px] font-bold">[{i + 1}]</span>
                <Globe className="size-3 shrink-0" />
                <span className="truncate">{s.title || domainOf(s.url)}</span>
                <ExternalLink className="size-3 shrink-0 opacity-60" />
              </span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">{domainOf(s.url)}</span>
              {s.snippet && <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-muted-foreground">{s.snippet}</span>}
            </a>
          ))}
      </>}
    />
  );
}

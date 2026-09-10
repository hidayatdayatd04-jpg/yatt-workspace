import { Button } from "@/components/ui/button";
import { Check, Plus } from "@/components/icons";
import type { DirectoryKind } from "./directory-data";
import { DIRECTORY } from "./directory-data";

export function DirectoryCards(props: {
  items: typeof DIRECTORY;
  isConnected: (kind: string) => boolean;
  hasError: (kind: string) => boolean;
  busy: boolean;
  onCard: (kind: DirectoryKind) => void;
}) {
  if (props.items.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">Tidak ada connector yang cocok.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {props.items.map((d) => {
        const connected = props.isConnected(d.kind);
        const error = props.hasError(d.kind);
        const Icon = d.Icon;
        const label = connected ? `Kelola ${d.name}` : error ? `Hubungkan ulang ${d.name}` : `Hubungkan ${d.name}`;
        return (
          <div key={d.kind} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${d.tile}`}>
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{d.name}</p>
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{d.desc}</p>
            </div>
            <Button
              variant={connected ? "ghost" : "outline"}
              size="icon"
              className={`size-8 shrink-0 rounded-xl ${connected ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : ""} ${error ? "border-amber-500/50 text-amber-600" : ""}`}
              disabled={props.busy}
              onClick={() => props.onCard(d.kind)}
              aria-label={label}
              title={label}
            >
              {connected ? <Check className="size-4" /> : <Plus className="size-4" />}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

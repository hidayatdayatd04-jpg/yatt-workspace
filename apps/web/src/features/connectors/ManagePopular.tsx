import { Button } from "@/components/ui/button";
import { Check } from "@/components/icons";
import { POPULAR, VISIBLE } from "./manage-catalog";
import type { ManageState } from "./use-manage-connectors";

export function ManagePopular({ manage }: { manage: ManageState }) {
  return (
    <>
      <p className="mb-3 mt-6 text-sm text-muted-foreground">Popular</p>
      <div className="grid gap-3 lg:grid-cols-3">
        {POPULAR.map((kind) => {
          const def = VISIBLE.find((v) => v.kind === kind)!;
          const connected = manage.isConnected(kind);
          const error = manage.hasError(kind);
          const Icon = def.Icon;
          return (
            <div key={kind} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
                <Icon className="size-5" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{def.name}</span>
              {connected && !error ? (
                <span className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3.5" /> On
                </span>
              ) : (
                <Button variant="outline" size="sm" className="rounded-xl" disabled={manage.test.isPending} onClick={() => manage.handleRowAction(kind)}>
                  Connect
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

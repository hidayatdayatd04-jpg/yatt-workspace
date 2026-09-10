import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowRight } from "@/components/icons";
import type { ManageState } from "./use-manage-connectors";

export function ManageDiscover({ manage }: { manage: ManageState }) {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {manage.searched.map((v) => {
        const connected = manage.isConnected(v.kind);
        const Icon = v.Icon;
        return (
          <div key={v.kind} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{v.name}</p>
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{v.desc}</p>
              <div className="mt-2 flex items-center gap-2">
                {v.kind !== "mikrotik" && (
                  <Switch
                    aria-label={`Aktifkan ${v.name}`}
                    checked={manage.stateOf(v.kind)?.enabled ?? false}
                    disabled={manage.save.isPending || !manage.stateOf(v.kind)?.configured}
                    onCheckedChange={(enabled) => {
                      const s = manage.stateOf(v.kind);
                      if (!s) return;
                      if (enabled && !s.configured) { manage.setSelected(v.kind); return; }
                      manage.save.mutate({ kind: v.kind, enabled, allowWrite: s.allowWrite, allowSend: s.allowSend, allowShell: false }, { onError: (err) => toast.error(err.message) });
                    }}
                  />
                )}
                <Button variant="ghost" size="sm" className="-ml-1 h-7 gap-1 px-2 text-xs" onClick={() => manage.setSelected(v.kind)}>
                  {connected ? "Kelola" : "Connect"} <ArrowRight className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

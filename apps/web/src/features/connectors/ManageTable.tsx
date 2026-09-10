import { Button } from "@/components/ui/button";
import { Check } from "@/components/icons";
import { FILTERS, filterLabel } from "./manage-catalog";
import type { ManageState } from "./use-manage-connectors";

export function ManageTable({ manage }: { manage: ManageState }) {
  return (
    <>
      <div className="mt-7 flex gap-1 text-sm">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => manage.setFilter(f)}
            className={`rounded-lg px-3 py-1.5 transition-colors ${manage.filter === f ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {filterLabel(f)}
          </button>
        ))}
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2.5 pr-4 font-medium">Connector</th>
              <th className="py-2.5 pr-4 font-medium">Type</th>
              <th className="py-2.5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {manage.data.isLoading ? (
              <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">Memuat connectors…</td></tr>
            ) : manage.tableRows.length === 0 ? (
              <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">Tidak ada connector yang cocok.</td></tr>
            ) : manage.tableRows.map((v) => {
              const s = manage.stateOf(v.kind);
              const connected = manage.isConnected(v.kind);
              const error = manage.hasError(v.kind);
              const Icon = v.Icon;
              return (
                <tr key={v.kind} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40">
                  <td className="py-3 pr-4">
                    <button type="button" onClick={() => manage.setSelected(v.kind)} className="flex items-center gap-3 text-left">
                      <span className="flex size-9 items-center justify-center rounded-xl border border-border bg-muted/40">
                        <Icon className="size-4" />
                      </span>
                      <span className="font-medium">{v.name}</span>
                    </button>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{v.type}</td>
                  <td className="py-3 text-right">
                    {error ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-amber-500" title={s?.lastError ?? "Perlu perhatian"}>⚠</span>
                        <Button variant="outline" size="sm" className="rounded-xl" disabled={manage.test.isPending} onClick={() => manage.handleRowAction(v.kind)}>Reconnect</Button>
                      </span>
                    ) : connected ? (
                      <button type="button" onClick={() => manage.setSelected(v.kind)} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground" title="Kelola">
                        <Check className="size-4 text-muted-foreground" />
                      </button>
                    ) : (
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => manage.handleRowAction(v.kind)}>Connect</Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

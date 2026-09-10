import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plug, Plus, Trash2 } from "@/components/icons";
import type { CustomConnectorDTO } from "./custom-connector-hooks";
import { useDeleteCustomConnector } from "./custom-connector-hooks";

export function CustomSection(props: { items: CustomConnectorDTO[]; loading: boolean; onAdd: () => void }) {
  const removeCustom = useDeleteCustomConnector();
  return (
    <>
      <div className="mb-2 mt-7 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Custom connectors</h3>
        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={props.onAdd}>
          <Plus className="size-3.5" /> Add custom
        </Button>
      </div>
      {props.loading ? (
        <p className="py-4 text-sm text-muted-foreground">Memuat…</p>
      ) : props.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-5 text-center">
          <Plug className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Belum ada custom connector. Tambahkan server MCP remote milik Anda.</p>
          <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={props.onAdd}>Add custom connector</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {props.items.map((c) => (
            <div key={c.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Plug className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{c.serverUrl}</p>
                {c.lastError && <p className="mt-1 line-clamp-2 text-[11px] text-destructive">{c.lastError}</p>}
              </div>
              <Button
                variant="ghost" size="icon" className="size-8 shrink-0 rounded-xl text-muted-foreground hover:text-destructive"
                disabled={removeCustom.isPending}
                onClick={() => removeCustom.mutate(c.id, { onSuccess: () => toast.success(`"${c.name}" dihapus.`), onError: (err) => toast.error(err.message) })}
                aria-label={`Hapus ${c.name}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

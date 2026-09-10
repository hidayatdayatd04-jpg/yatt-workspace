import { Button } from "@/components/ui/button";
import { ArrowLeft } from "@/components/icons";
import { VISIBLE, type VisibleKind } from "./manage-catalog";
import type { ManageState } from "./use-manage-connectors";
import { ConnectorsPanel } from "./ConnectorsPanel";
import { GoogleServiceConfig } from "./GoogleServiceConfig";

export function ManageDetail({ manage }: { manage: ManageState }) {
  const selected = manage.selected as VisibleKind;
  const def = VISIBLE.find((v) => v.kind === selected)!;
  const state = manage.stateOf(selected);
  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-5 -ml-3" onClick={() => manage.setSelected(null)}>
        <ArrowLeft className="size-4" /> Semua connectors
      </Button>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">{def.name}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{def.desc}</p>
      </div>
      {selected === "mikrotik" ? (
        <ConnectorsPanel />
      ) : state ? (
        <div className="max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-7">
          <GoogleServiceConfig key={`${state.kind}-${state.allowWrite}-${state.allowSend}`} integration={state} />
        </div>
      ) : null}
    </div>
  );
}

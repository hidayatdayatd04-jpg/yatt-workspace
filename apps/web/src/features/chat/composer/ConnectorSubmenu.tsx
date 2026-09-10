import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Plus, Settings, Plug } from "@/components/icons";
import { Folder, Mail, Calendar } from "@/components/icons";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useIntegrations, useSaveIntegration } from "@/features/connectors/integration-hooks";
import { useConnectAnyConnector } from "@/features/connectors/connector-hooks";
import type { ConnectorDTO } from "@shared/index";
import { ConnectorPickerItem } from "../ConnectorPickerItem";
import { MenuTile } from "./MenuTile";

const APP_ICONS = { drive: Folder, gmail: Mail, calendar: Calendar } as const;
const APP_LABELS = { drive: "Google Drive", gmail: "Gmail", calendar: "Google Calendar" } as const;
const APP_TILE = {
  drive: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  gmail: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  calendar: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
} as const;
type AppKind = keyof typeof APP_ICONS;

export function ConnectorSubmenu(props: {
  running: boolean;
  connectors: ConnectorDTO[];
  selectedId: string | null;
  onSelectConnector?: (id: string) => void;
  onBrowse: () => void;
  onManage: () => void;
}) {
  const integrations = useIntegrations();
  const saveIntegration = useSaveIntegration();
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const connectMutation = useConnectAnyConnector();

  function handleConnect(c: ConnectorDTO) {
    if (props.running) return;
    setConnectingId(c.id);
    connectMutation.mutate(c.id, {
      onSuccess: () => {
        setConnectingId(null);
        props.onSelectConnector?.(c.id);
        toast.success(`Berhasil terhubung ke ${c.label}!`);
      },
      onError: (err) => {
        setConnectingId(null);
        toast.error(`Gagal terhubung ke ${c.label}: ${err.message}`);
      },
    });
  }

  function handleItemClick(c: ConnectorDTO) {
    if (props.running) return;
    if (c.status === "connected") {
      props.onSelectConnector?.(c.id);
      toast.success(`Connector ${c.label} dipilih.`);
    } else {
      handleConnect(c);
    }
  }

  const apps = (integrations.data?.integrations ?? []).filter(
    (i): i is typeof i & { kind: AppKind } => (i.kind === "drive" || i.kind === "gmail" || i.kind === "calendar") && i.configured && i.enabled,
  );
  const hasRouters = props.connectors.length > 0;
  const total = apps.length + props.connectors.length;

  return (
    <>
      <div className="flex items-center justify-between px-2.5 pb-1.5 pt-1">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Plug className="size-3.5 text-indigo-500" /> Connectors
        </p>
        <span className="text-[11px] text-muted-foreground">{total > 0 ? `${total} terdaftar` : "belum ada"}</span>
      </div>
      <DropdownMenuItem onSelect={props.onBrowse} className="gap-3 rounded-xl px-2.5 py-2 text-[13px] font-medium cursor-pointer">
        <MenuTile><Plus className="size-4" /></MenuTile>
        <span className="flex-1">Add connector</span>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={props.onManage} className="gap-3 rounded-xl px-2.5 py-2 text-[13px] font-medium cursor-pointer">
        <MenuTile><Settings className="size-4" /></MenuTile>
        <span className="flex-1">Manage connectors</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator className="my-1.5" />
      {apps.length === 0 && !hasRouters ? (
        <p className="px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">Belum ada connector terdaftar. Tambahkan lewat Add connector.</p>
      ) : (
        <>
          {apps.map((item) => {
            const Icon = APP_ICONS[item.kind];
            return (
              <div key={item.kind} className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-accent/60" onClick={(e) => e.preventDefault()}>
                <MenuTile className={APP_TILE[item.kind]}><Icon className="size-4" /></MenuTile>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{APP_LABELS[item.kind]}</span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className={`size-1.5 rounded-full ${item.status === "error" ? "bg-amber-500" : "bg-emerald-500"}`} />
                    {item.status === "error" ? (item.lastError ?? "Perlu perhatian") : "Terhubung"}
                  </span>
                </span>
                <Switch
                  aria-label={`Aktifkan ${APP_LABELS[item.kind]}`}
                  checked={item.enabled}
                  disabled={saveIntegration.isPending}
                  onCheckedChange={(enabled) => saveIntegration.mutate(
                    { kind: item.kind, enabled, allowWrite: item.allowWrite, allowSend: item.allowSend, allowShell: false },
                    { onError: (err) => toast.error(err.message) },
                  )}
                />
              </div>
            );
          })}
          {hasRouters && (
            <>
              <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Router</p>
              <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
                {props.connectors.map((c) => (
                  <ConnectorPickerItem key={c.id} connector={c} isSelected={c.id === props.selectedId} isConnecting={connectingId === c.id} disabled={props.running} onItemClick={handleItemClick} onConnect={handleConnect} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

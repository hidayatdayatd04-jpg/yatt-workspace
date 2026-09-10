import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Search, ExternalLink } from "@/components/icons";
import type { IntegrationKind } from "@shared/index";
import { useIntegrations, useGoogleAuthUrl } from "./integration-hooks";
import { useCustomConnectors } from "./custom-connector-hooks";
import { CustomConnectorDialog } from "./CustomConnectorDialog";
import { DIRECTORY, type DirectoryFilter, type DirectoryKind } from "./directory-data";
import { DirectoryCards } from "./DirectoryCards";
import { CustomSection } from "./CustomSection";

export function BrowseConnectorsDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onManageKind?: (kind: IntegrationKind | "mikrotik") => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DirectoryFilter>("all");
  const [customOpen, setCustomOpen] = useState(false);
  const integrations = useIntegrations();
  const custom = useCustomConnectors();
  const authUrl = useGoogleAuthUrl();

  const states = integrations.data?.integrations ?? [];
  const stateOf = (kind: string) => states.find((s) => s.kind === kind);
  const isConnected = (kind: string) => {
    const s = stateOf(kind);
    return !!s?.configured && !!s?.enabled && s.status !== "error";
  };
  const hasError = (kind: string) => stateOf(kind)?.status === "error";
  const matchFilter = (kind: string) => {
    if (filter === "all") return true;
    const connected = isConnected(kind);
    return filter === "connected" ? connected : !connected;
  };

  const visible = DIRECTORY.filter(
    (d) => `${d.name} ${d.desc}`.toLowerCase().includes(query.toLowerCase()) && matchFilter(d.kind),
  );
  const customVisible = (custom.data?.connectors ?? []).filter(
    (c) => `${c.name} ${c.serverUrl}`.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || (filter === "connected" ? c.status === "connected" : c.status !== "connected")),
  );

  async function handleConnect(kind: DirectoryKind) {
    if (kind === "mikrotik") {
      props.onOpenChange(false);
      props.onManageKind?.(kind);
      return;
    }
    try {
      const redirectUri = `${window.location.origin}/api/integrations/google/callback`;
      const res = await authUrl.mutateAsync({ redirectUri });
      window.location.href = res.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memulai login Google.");
    }
  }

  function handleCard(kind: DirectoryKind) {
    if (isConnected(kind)) {
      props.onOpenChange(false);
      props.onManageKind?.(kind);
    } else {
      void handleConnect(kind);
    }
  }

  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent className="max-h-[88svh] max-w-4xl overflow-y-auto rounded-2xl p-4 sm:p-7" aria-describedby={undefined}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-semibold">Directory</DialogTitle>
            <Button
              variant="ghost" size="sm" className="gap-1.5 text-xs"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${window.location.origin}/connectors`);
                  toast.success("Tautan connectors disalin.");
                } catch {
                  toast.error("Gagal menyalin tautan.");
                }
              }}
            >
              <ExternalLink className="size-3.5" /> Copy link
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search connectors" aria-label="Cari connectors" className="h-10 rounded-xl bg-card pl-9" />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as DirectoryFilter)}
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground"
              aria-label="Filter connectors"
            >
              <option value="all">Filter: All</option>
              <option value="connected">Filter: Connected</option>
              <option value="not-connected">Filter: Not connected</option>
            </select>
          </div>
          <div className="mb-2 mt-6 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Top connectors</h3>
          </div>
          {integrations.isLoading ? (
            <p className="py-6 text-sm text-muted-foreground">Memuat connectors…</p>
          ) : (
            <DirectoryCards items={visible} isConnected={isConnected} hasError={hasError} busy={authUrl.isPending} onCard={handleCard} />
          )}
          <CustomSection items={customVisible} loading={custom.isLoading} onAdd={() => setCustomOpen(true)} />
        </DialogContent>
      </Dialog>
      <CustomConnectorDialog open={customOpen} onOpenChange={setCustomOpen} />
    </>
  );
}

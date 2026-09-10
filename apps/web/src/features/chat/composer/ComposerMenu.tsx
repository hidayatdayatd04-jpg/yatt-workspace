import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Plug, Globe, Brain, ImagePlus, FileText } from "@/components/icons";
import { useIntegrations } from "@/features/connectors/integration-hooks";
import { usePreferences } from "../chat-hooks";
import { apiFetch } from "@/lib/api";
import { navigate } from "@/lib/router";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import type { ConnectorDTO } from "@shared/index";
import { BrowseConnectorsDialog } from "@/features/connectors/BrowseConnectorsDialog";
import { captureScreenshot } from "./composer-screenshot";
import { ConnectorSubmenu } from "./ConnectorSubmenu";
import { MenuTile } from "./MenuTile";

export function ComposerMenu(props: {
  uploading: boolean;
  running: boolean;
  connectors: ConnectorDTO[];
  selectedId: string | null;
  onSelectConnector?: (id: string) => void;
  onAddRouter?: () => void;
  onPickFile?: (images: boolean) => void;
  onAttachFile?: (file: File) => void;
}) {
  const integrations = useIntegrations();
  const prefs = usePreferences();
  const webSearch = useQuery({
    queryKey: ["web-search-status"],
    queryFn: () => apiFetch<{ configured: boolean }>("/api/web-search-settings"),
    staleTime: 30000,
    retry: false,
  });
  const [browseOpen, setBrowseOpen] = useState(false);

  const totalRegistered =
    (integrations.data?.integrations ?? []).filter((i) => (i.kind === "drive" || i.kind === "gmail" || i.kind === "calendar") && i.configured && i.enabled).length +
    props.connectors.length;
  const webOn = webSearch.data?.configured ?? false;
  const memoryOn = prefs.data?.autoCompact ?? false;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-xl text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95 cursor-pointer"
            aria-label="Tambah lampiran dan connectors"
            title="Tambah lampiran dan connectors"
          >
            {props.uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-5" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" sideOffset={12} className="w-76 max-w-[calc(100vw-2rem)] rounded-2xl border border-border/70 bg-popover/95 p-2 shadow-2xl backdrop-blur-xl">
          <DropdownMenuItem onSelect={() => props.onPickFile?.(false)} className="gap-3 rounded-xl px-2.5 py-2.5 text-sm cursor-pointer">
            <MenuTile><FileText className="size-4" /></MenuTile>
            <span className="flex-1 font-medium">Add files or photos</span>
            <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Ctrl U</kbd>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => props.onAttachFile && void captureScreenshot(props.onAttachFile)} className="gap-3 rounded-xl px-2.5 py-2.5 text-sm cursor-pointer">
            <MenuTile><ImagePlus className="size-4" /></MenuTile>
            <span className="flex-1 font-medium">Take a screenshot</span>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-3 rounded-xl px-2.5 py-2.5 text-sm cursor-pointer">
              <MenuTile className="bg-indigo-500/12 text-indigo-600 dark:text-indigo-400"><Plug className="size-4" /></MenuTile>
              <span className="flex-1 text-left font-medium">Connectors</span>
              {totalRegistered > 0 && (
                <span className="mr-1 rounded-full bg-indigo-500/12 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">{totalRegistered}</span>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent sideOffset={10} className="w-80 rounded-2xl border border-border/70 bg-popover/95 p-2 shadow-2xl backdrop-blur-xl">
              <ConnectorSubmenu
                running={props.running}
                connectors={props.connectors}
                selectedId={props.selectedId}
                onSelectConnector={props.onSelectConnector}
                onBrowse={() => setBrowseOpen(true)}
                onManage={() => navigate({ name: "connectors" })}
              />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator className="my-1.5" />
          <DropdownMenuItem onSelect={() => navigate({ name: "settings", section: "web-search" })} className="gap-3 rounded-xl px-2.5 py-2.5 text-sm cursor-pointer">
            <MenuTile><Globe className="size-4" /></MenuTile>
            <span className="flex-1 font-medium">Web search</span>
            {webOn
              ? <span className="flex size-5 items-center justify-center rounded-full bg-indigo-500 text-[11px] font-bold text-white">✓</span>
              : <span className="text-[11px] text-muted-foreground">Off</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate({ name: "settings", section: "memory" })} className="gap-3 rounded-xl px-2.5 py-2.5 text-sm cursor-pointer">
            <MenuTile><Brain className="size-4" /></MenuTile>
            <span className="flex-1 font-medium">Memory</span>
            {memoryOn
              ? <span className="flex size-5 items-center justify-center rounded-full bg-indigo-500 text-[11px] font-bold text-white">✓</span>
              : <span className="text-[11px] text-muted-foreground">Off</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BrowseConnectorsDialog open={browseOpen} onOpenChange={setBrowseOpen} onManageKind={() => navigate({ name: "connectors" })} />
    </>
  );
}

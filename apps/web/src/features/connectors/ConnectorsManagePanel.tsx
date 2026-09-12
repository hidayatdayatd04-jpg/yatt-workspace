import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "@/components/icons";
import type { VisibleKind } from "./manage-catalog";
import { useManageConnectors } from "./use-manage-connectors";
import { ManagePopular } from "./ManagePopular";
import { ManageTable } from "./ManageTable";
import { ManageDiscover } from "./ManageDiscover";
import { ManageDetail } from "./ManageDetail";
import { BrowseConnectorsDialog } from "./BrowseConnectorsDialog";

export function ConnectorsManagePanel(props: { initialSelected?: VisibleKind | null; autoBrowse?: boolean }) {
  const manage = useManageConnectors(props);
  if (manage.selected) return <ManageDetail manage={manage} />;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Connectors</h2>
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input value={manage.query} onChange={(e) => manage.setQuery(e.target.value)} placeholder="Search connectors" aria-label="Cari connectors" className="h-10 rounded-xl bg-card pl-9" />
        </div>
        <Button className="ml-auto rounded-xl" onClick={() => manage.setBrowseOpen(true)}>Add</Button>
      </div>
      <div className="mt-4 flex gap-1 text-sm">
        {(["mine", "discover"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => manage.setTab(t)}
            className={`rounded-lg px-3 py-1.5 transition-colors ${manage.tab === t ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t === "mine" ? "Your connectors" : "Discover"}
          </button>
        ))}
      </div>
      {manage.tab === "mine" ? (
        <><ManagePopular manage={manage} /><ManageTable manage={manage} /></>
      ) : (
        <ManageDiscover manage={manage} />
      )}
      <BrowseConnectorsDialog open={manage.browseOpen} onOpenChange={manage.setBrowseOpen} onManageKind={(kind) => kind === "mikrotik" || kind === "drive" || kind === "gmail" || kind === "calendar" ? manage.setSelected(kind) : undefined} />
    </div>
  );
}

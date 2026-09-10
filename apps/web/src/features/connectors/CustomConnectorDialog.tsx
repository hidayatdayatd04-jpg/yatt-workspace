import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCreateCustomConnector } from "./custom-connector-hooks";

export function CustomConnectorDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const create = useCreateCustomConnector();

  function reset() {
    setName("");
    setServerUrl("");
    create.reset();
  }

  async function handleContinue() {
    if (!name.trim() || !serverUrl.trim()) {
      toast.error("Isi nama dan URL server MCP.");
      return;
    }
    try {
      const res = await create.mutateAsync({ name: name.trim(), serverUrl: serverUrl.trim() });
      if (res.connector.status === "error") {
        toast.warning(`Connector tersimpan, tetapi server bermasalah: ${res.connector.lastError ?? "tidak terjangkau"}`);
      } else {
        toast.success(`Custom connector "${res.connector.name}" tersimpan dan terjangkau.`);
      }
      reset();
      props.onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan custom connector.");
    }
  }

  const valid = name.trim().length > 0 && serverUrl.trim().length > 0;

  return (
    <Dialog open={props.open} onOpenChange={(open) => { if (!open) reset(); props.onOpenChange(open); }}>
      <DialogContent className="max-w-lg rounded-2xl p-6 sm:p-8" aria-describedby={undefined}>
        <DialogHeader className="mb-2 flex flex-row items-start justify-between">
          <DialogTitle className="text-xl font-semibold tracking-tight">Add custom connector</DialogTitle>
        </DialogHeader>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Connect YATT Agent to your data and tools.{" "}
          <span className="font-medium text-foreground underline underline-offset-4">Learn more about connectors</span> or get started with{" "}
          <span className="font-medium text-foreground underline underline-offset-4">pre-built ones</span>.
        </p>
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              aria-label="Nama connector"
              maxLength={100}
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">Shown in the connectors list.</p>
          </div>
          <div className="space-y-1.5">
            <Input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="Remote MCP server URL"
              aria-label="Remote MCP server URL"
              inputMode="url"
              maxLength={1024}
              className="h-11 rounded-xl font-mono text-xs"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              The HTTPS address where the server accepts MCP requests, for example https://mcp.example.com/mcp.
            </p>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Only use connectors from developers you trust. YATT Agent does not control which tools developers make available and cannot verify that they will work as intended or that they won&apos;t change.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => props.onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button className="rounded-xl" onClick={() => void handleContinue()} disabled={!valid || create.isPending}>
            {create.isPending ? "Menyimpan…" : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

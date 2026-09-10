import { supportsVision } from "@shared/index";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { DialogProviderConfig } from "../provider-dialog/provider-presets";
import { useProviderForm } from "../provider-dialog/use-provider-form";
import { useVisionActions } from "./use-vision-actions";
import { VisionModelsSection } from "./VisionModelsSection";
import { KIND_OPTIONS, VisionSettingsFields } from "./VisionSettingsFields";

export function VisionConfigDialog(props: { provider: DialogProviderConfig; onChange: (provider: DialogProviderConfig) => void; onClose: () => void }) {
  const form = useProviderForm(props.provider, true, supportsVision);
  const actions = useVisionActions(form, props.provider, (open) => { if (!open) props.onClose(); });
  return <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Konfigurasi Provider Vision</DialogTitle>
        <DialogDescription>Kelola provider untuk membaca lampiran gambar.</DialogDescription></DialogHeader>
      <VisionSettingsFields form={form} onKindChange={(kind) => {
        const option = KIND_OPTIONS.find((item) => item.value === kind)!;
        props.onChange({ ...props.provider, kind: kind as DialogProviderConfig["kind"], name: option.label,
          baseUrl: option.defaultUrl, models: [], activeModel: "" });
      }} />
      <VisionModelsSection form={form} actions={actions} />
      <DialogFooter>
        {props.provider.hasKey && <Button variant="destructive" onClick={actions.handleDelete}>Hapus Provider</Button>}
        <Button variant="outline" onClick={props.onClose}>Batal</Button>
        <Button disabled={actions.savePending || !form.models.length} onClick={actions.handleSave}>Simpan Konfigurasi</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

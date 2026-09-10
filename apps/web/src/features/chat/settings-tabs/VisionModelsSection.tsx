import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { supportsVision } from "@shared/index";
import { ProviderRecommendationChips } from "../provider-dialog/ProviderRecommendationChips";
import { ProviderRemoteModels } from "../provider-dialog/ProviderRemoteModels";
import { PRESET_RECOMMENDATIONS } from "../provider-dialog/provider-presets";
import type { ProviderForm } from "../provider-dialog/use-provider-form";
import type { VisionActions } from "./use-vision-actions";

export function VisionModelsSection({ form, actions }: { form: ProviderForm; actions: VisionActions }) {
  const recommendations = (form.kind === "custom" ? ["gpt-4o-mini", "llama3.2-vision"] : PRESET_RECOMMENDATIONS[form.kind ?? ""] ?? []).filter(supportsVision);
  return <div className="space-y-4 rounded-xl border p-4">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">Daftar model ({form.models.length})</h3>
      <Button variant="outline" size="sm" disabled={form.fetchingRemote || (!form.apiKey && !form.hasSavedKey)}
        onClick={() => void actions.handleFetchRemoteModels()}>{form.fetchingRemote ? "Mengambil..." : "Tarik Model"}</Button>
    </div>
    <p className="text-xs text-muted-foreground">Model aktif dicoba dahulu, lalu model lain sesuai urutan daftar. Model tanpa dukungan gambar ditolak.</p>
    <ProviderRecommendationChips recommendations={recommendations} models={form.models} onAdd={form.handleAddModel} />
    <ProviderRemoteModels remoteModels={form.remoteModels} models={form.models} onAdd={form.handleAddModel} />
    <div role="radiogroup" aria-label="Model vision aktif" className="space-y-2">
      {form.models.map((model) => <div key={model} className="flex items-center gap-2 rounded-lg border p-2 text-xs">
        <label className="flex min-w-0 flex-1 items-center gap-2 break-all">
          <input type="radio" name="vision-active-model" checked={model === form.activeModel} onChange={() => form.setActiveModel(model)} />
          {model}{model === form.activeModel && <span className="shrink-0 text-muted-foreground">Model aktif</span>}
        </label>
        <Button variant="ghost" size="sm" aria-label={`Hapus model ${model}`} onClick={() => form.handleRemoveModel(model)}>Hapus</Button>
      </div>)}
    </div>
    <TextField id="vision-manual-model" label="Tambah model manual" value={form.newModelInput} maxLength={255}
      onChange={(e) => form.setNewModelInput(e.target.value)} onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); form.handleAddModel(form.newModelInput); }
      }} />
    <Button variant="secondary" size="sm" disabled={!form.newModelInput.trim() || form.models.length >= 50}
      onClick={() => form.handleAddModel(form.newModelInput)}>Tambah Model</Button>
  </div>;
}

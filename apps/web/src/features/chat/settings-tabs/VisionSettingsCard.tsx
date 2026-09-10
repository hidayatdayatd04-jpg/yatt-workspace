import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProviderCard } from "./ProviderCard";
import { VisionConfigDialog } from "./VisionConfigDialog";
import { useVisionProviders, useToggleVisionProvider, useDeleteVisionProvider } from "./use-vision-list";
import type { DialogProviderConfig } from "../provider-dialog/provider-presets";

export function VisionSettingsCard() {
  const providers = useVisionProviders();
  const toggle = useToggleVisionProvider();
  const remove = useDeleteVisionProvider();
  const [editing, setEditing] = useState<DialogProviderConfig | null>(null);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-semibold">Daftar Provider Vision</h2>
        <p className="text-xs text-muted-foreground">Pembaca lampiran gambar dengan fallback otomatis antar model dan provider.</p></div>
      <Button size="sm" variant="outline" onClick={() => setEditing({ id: crypto.randomUUID(), kind: "gemini",
        name: "Google Gemini", models: ["gemini-2.0-flash"], activeModel: "gemini-2.0-flash", enabled: true })}>Tambah Provider Vision</Button>
    </div>
    <p className="text-xs text-muted-foreground">Provider dicoba sesuai urutan penambahan. Jika semuanya gagal, gunakan model primer yang mendukung gambar, lalu fallback provider AI.</p>
    {providers.isPending && <p role="status">Memuat provider vision...</p>}
    {providers.isError && <div role="alert"><p>Gagal memuat provider vision: {providers.error.message}</p>
      <Button variant="outline" onClick={() => void providers.refetch()}>Coba Lagi</Button></div>}
    {providers.data?.length === 0 && <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Belum ada provider vision. Tambahkan provider untuk mulai membaca gambar.</p>}
    <div className="grid gap-4 sm:grid-cols-2">{providers.data?.map((provider) =>
      <ProviderCard key={provider.id} p={provider} modelLimit={undefined} togglePending={toggle.isPending || remove.isPending} onEdit={setEditing}
        onDelete={() => {
          if (!remove.isPending && confirm(`Hapus provider vision ${provider.name}?`)) remove.mutate(provider.id, {
            onError: (error) => toast.error(error.message),
          });
        }}
        onToggle={() => toggle.mutate({ id: provider.id, enabled: !provider.enabled }, {
          onError: (error) => toast.error(error.message),
        })} />)}</div>
    {editing && <VisionConfigDialog provider={editing} onChange={setEditing} onClose={() => setEditing(null)} />}
  </div>;
}

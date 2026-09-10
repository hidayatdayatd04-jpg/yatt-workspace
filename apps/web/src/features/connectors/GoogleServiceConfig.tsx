import { useState } from "react";
import { toast } from "sonner";
import type { IntegrationDTO } from "@shared/index";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  useSaveIntegration,
  useTestIntegration,
  useGoogleAccount,
  useDisconnectService,
  useIntegrations,
} from "./integration-hooks";
import { GoogleLoginBlock, type GoogleServiceKind } from "./GoogleLoginBlock";
import { ServicePermission } from "./ServicePermission";

const SERVICE_TEXT: Record<GoogleServiceKind, { name: string; desc: string }> = {
  drive: { name: "Google Drive", desc: "Cari file, baca dokumen, dan buat file teks. Agent membaca sesuai izin akun Google Anda." },
  gmail: { name: "Gmail", desc: "Cari dan baca email, buat draft, dan kirim pesan saat Anda memintanya." },
  calendar: { name: "Google Calendar", desc: "Lihat jadwal, buat dan hapus event kalender." },
};

/** Konfigurasi Drive/Gmail/Kalender: login Google + izin (tanpa form token manual). */
export function GoogleServiceConfig({ integration: item }: { integration: IntegrationDTO }) {
  const kind = item.kind as GoogleServiceKind;
  const text = SERVICE_TEXT[kind];
  const account = useGoogleAccount();
  const disconnect = useDisconnectService();
  const integrations = useIntegrations();
  const save = useSaveIntegration();
  const test = useTestIntegration();
  const [permissions, setPermissions] = useState({ allowWrite: item.allowWrite, allowSend: item.allowSend });

  const email = item.accountEmail ?? account.data?.services[kind]?.accountEmail;
  const busy = save.isPending || test.isPending || disconnect.isPending;

  async function handleSave() {
    try {
      await save.mutateAsync({ kind, enabled: true, ...permissions, allowShell: false });
      toast.success(`${text.name} diaktifkan.`);
      void integrations.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
    }
  }

  async function handleToggleEnabled(enabled: boolean) {
    try {
      await save.mutateAsync({ kind, enabled, allowWrite: permissions.allowWrite, allowSend: permissions.allowSend, allowShell: false });
      toast.success(enabled ? `${text.name} diaktifkan.` : `${text.name} dinonaktifkan.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status.");
    }
  }

  if (account.isLoading) {
    return <p className="py-6 text-sm text-muted-foreground">Memuat status akun Google…</p>;
  }

  if (!item.configured) {
    return (
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-muted-foreground">{text.desc}</p>
        <GoogleLoginBlock kind={kind} busy={busy} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm leading-relaxed">
        Terhubung sebagai <strong>{email ?? "akun Google"}</strong> — {text.name} aktif. Token di-refresh otomatis.
      </div>
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border px-4 py-3">
        <span><span className="block text-sm font-medium">Aktifkan {text.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">Agent dapat memakai layanan ini di chat.</span></span>
        <Switch aria-label={`Aktifkan ${text.name}`} checked={item.enabled} disabled={busy} onCheckedChange={(v) => void handleToggleEnabled(v)} />
      </div>
      <div className="divide-y divide-border rounded-2xl border border-border px-4">
        <ServicePermission
          label={kind === "gmail" ? "Buat draft email" : kind === "calendar" ? "Buat & hapus event" : "Izinkan perubahan file"}
          description={kind === "gmail" ? "Agent dapat menyiapkan draft di Gmail." : kind === "calendar" ? "Agent dapat membuat dan menghapus event kalender." : "Agent dapat membuat file teks di Drive."}
          checked={permissions.allowWrite}
          disabled={busy}
          onChange={(v) => setPermissions((p) => ({ ...p, allowWrite: v }))}
        />
        {kind === "gmail" && (
          <ServicePermission
            label="Izinkan pengiriman"
            description="Agent dapat mengirim email ketika Anda memintanya lewat chat."
            checked={permissions.allowSend}
            disabled={busy}
            onChange={(v) => setPermissions((p) => ({ ...p, allowSend: v }))}
          />
        )}
      </div>
      {item.lastError && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{item.lastError}</p>}
      {item.lastCheckedAt && <p className="text-xs text-muted-foreground">Terakhir diuji: {new Date(item.lastCheckedAt).toLocaleString("id-ID")}</p>}
      <div className="flex flex-wrap gap-2 border-t border-border pt-5">
        <Button onClick={() => void handleSave()} disabled={busy}>{save.isPending ? "Menyimpan…" : "Simpan izin"}</Button>
        <Button type="button" variant="outline" disabled={busy || !item.enabled} onClick={() => test.mutate(kind, { onSuccess: () => toast.success("Koneksi berhasil diverifikasi."), onError: (err) => toast.error(err.message) })}>
          {test.isPending ? "Menguji…" : "Uji koneksi"}
        </Button>
        <Button
          type="button" variant="ghost" className="text-destructive sm:ml-auto" disabled={busy}
          onClick={() => disconnect.mutate(kind, { onSuccess: () => { toast.success(`${text.name} diputuskan.`); void integrations.refetch(); }, onError: (err) => toast.error(err.message) })}
        >
          {disconnect.isPending ? "Memutus…" : `Putuskan ${text.name}`}
        </Button>
      </div>
    </div>
  );
}

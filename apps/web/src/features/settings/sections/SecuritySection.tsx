import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SafeModeTab } from "@/features/chat/settings-tabs/SafeModeTab";
import { useAuth } from "@/features/auth/auth";
import { apiFetch } from "@/lib/api";

export function SecuritySection() {
  const { logout } = useAuth();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  async function change() {
    setBusy(true);
    try {
      await apiFetch("/api/auth/password", { method: "POST", body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }) });
      toast.success("Password diubah. Silakan login kembali dengan password baru.");
      // Semua sesi sudah dicabut server; paksa kembali ke halaman login.
      await logout();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah password.");
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card/60 p-6">
        <h2 className="text-base font-semibold">Akses agent dalam kendali Anda</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Izin membaca, mengubah file, mengirim pesan, dan menjalankan shell diatur per connector. Token aplikasi dan kredensial router disimpan terenkripsi.
          Perubahan MikroTik menggunakan Safe Mode; izin menulis router tetap terpisah dari izin aplikasi lain.
        </p>
      </div>
      <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-6">
        <h3 className="text-sm font-semibold">Ubah password</h3>
        <label className="block space-y-2 text-sm"><span>Password saat ini</span><Input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" /></label>
        <label className="block space-y-2 text-sm"><span>Password baru</span><Input type="password" placeholder="Minimal 8 karakter" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" /></label>
        <Button size="sm" disabled={busy || !oldPw || newPw.length < 8} onClick={() => void change()}>
          {busy ? "Menyimpan…" : "Ubah password"}
        </Button>
      </div>
      <SafeModeTab />
    </div>
  );
}

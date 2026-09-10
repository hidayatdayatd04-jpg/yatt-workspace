import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Key } from "@/components/icons";
import { useAuth } from "@/features/auth/auth";
import { apiFetch } from "@/lib/api";
import { ProfileCardHeader, ProfileField } from "./profile-ui";

function passwordStrength(pw: string): { label: string; bar: string; width: string } | null {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Lemah", bar: "bg-red-500", width: "w-1/4" };
  if (score === 2) return { label: "Sedang", bar: "bg-amber-500", width: "w-2/4" };
  if (score === 3) return { label: "Kuat", bar: "bg-lime-500", width: "w-3/4" };
  return { label: "Sangat kuat", bar: "bg-emerald-500", width: "w-full" };
}

export function ProfilePasswordForm() {
  const { logout } = useAuth();
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(newPw);

  async function change() {
    if (newPw !== confirmPw) {
      toast.error("Konfirmasi password tidak sama.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ newPassword: newPw }),
      });
      toast.success("Password diubah. Silakan login kembali dengan password baru.");
      // Semua sesi sudah dicabut server; paksa kembali ke halaman login.
      await logout();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah password.");
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-border/50 bg-card/60 p-6 shadow-sm">
      <ProfileCardHeader
        icon={Key}
        title="Ganti password"
        description="Setelah diganti, semua sesi langsung logout dan Anda diminta login ulang."
      />
      <div className="space-y-2">
        <ProfileField
          id="new-password"
          label="Password baru"
          type="password"
          placeholder="Minimal 8 karakter"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          autoComplete="new-password"
        />
        {strength ? (
          <div className="flex items-center gap-2 pt-0.5" aria-live="polite">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full transition-all ${strength.bar} ${strength.width}`} />
            </div>
            <span className="w-20 text-right text-xs font-medium text-muted-foreground">{strength.label}</span>
          </div>
        ) : null}
      </div>
      <ProfileField
        id="confirm-password"
        label="Konfirmasi password baru"
        type="password"
        placeholder="Ulangi password baru"
        value={confirmPw}
        onChange={(e) => setConfirmPw(e.target.value)}
        autoComplete="new-password"
      />
      <Button size="sm" className="rounded-xl" disabled={busy || newPw.length < 8 || confirmPw.length < 8} onClick={() => void change()}>
        {busy ? "Menyimpan…" : "Ganti password"}
      </Button>
    </section>
  );
}
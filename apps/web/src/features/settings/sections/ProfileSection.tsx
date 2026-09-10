import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { User } from "@/components/icons";
import { useAuth } from "@/features/auth/auth";
import { apiFetch } from "@/lib/api";
import { ProfileCardHeader, ProfileField } from "./profile-ui";
import { ProfilePasswordForm } from "./ProfilePasswordForm";

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProfileSection() {
  const { profile, refresh } = useAuth();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = username !== (profile?.username ?? "") || email !== (profile?.email ?? "");

  async function save() {
    const uname = username.trim();
    if (!USERNAME_RE.test(uname)) {
      toast.error("Username 3-32 karakter; hanya huruf, angka, titik, strip, dan underscore.");
      return;
    }
    const mail = email.trim().toLowerCase();
    if (mail && !EMAIL_RE.test(mail)) {
      toast.error("Format email tidak valid.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ username: uname, email: mail || null }),
      });
      await refresh();
      toast.success("Profil diperbarui.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan profil.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="space-y-5 rounded-2xl border border-border/50 bg-card/60 p-6 shadow-sm">
        <ProfileCardHeader
          icon={User}
          title="Identitas akun"
          description="Username dan email dipakai untuk masuk ke workspace Anda."
        />
        <ProfileField
          id="username"
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={32}
          placeholder="3-32 karakter"
        />
        <ProfileField
          id="email"
          label="Email"
          hint="opsional; dipakai untuk login"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          placeholder="nama@contoh.com"
        />
        <div className="flex items-center gap-3 pt-1">
          <Button size="sm" className="rounded-xl" onClick={() => void save()} disabled={busy || !dirty}>
            {busy ? "Menyimpan…" : "Simpan perubahan"}
          </Button>
          {dirty && !busy ? <span className="text-xs text-muted-foreground">Ada perubahan yang belum disimpan.</span> : null}
        </div>
      </section>

      <ProfilePasswordForm />
    </div>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleG } from "@/components/icons";
import { useGoogleConfig, useGoogleAuthUrl } from "./integration-hooks";

export type GoogleServiceKind = "drive" | "gmail" | "calendar";

/** Blok login Google (satu login untuk Drive+Gmail+Kalender). */
export function GoogleLoginBlock({ kind, busy }: { kind: GoogleServiceKind; busy: boolean }) {
  const config = useGoogleConfig();
  const authUrl = useGoogleAuthUrl();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const hasEnvClient = config.data?.hasEnvClient ?? false;

  async function handleLogin() {
    try {
      const redirectUri = `${window.location.origin}/api/integrations/google/callback`;
      const res = await authUrl.mutateAsync({
        redirectUri,
        ...(clientId.trim() ? { clientId: clientId.trim() } : {}),
        ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}),
      });
      window.location.href = res.url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal membuat URL login Google.";
      toast.error(msg, { description: !hasEnvClient ? "Server belum punya Client ID (restart dev server setelah isi .env), atau isi Client ID/Secret manual di bawah." : undefined });
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/40 p-5">
      <p className="text-sm font-medium">Hubungkan akun Google Anda</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Satu login mengaktifkan Drive, Gmail, dan Kalender sekaligus. Token tersimpan terenkripsi di perangkat ini.
      </p>
      <Button className="mt-4" onClick={() => void handleLogin()} disabled={busy || authUrl.isPending || config.isLoading}>
        <GoogleG className="size-4" /> {authUrl.isPending ? "Menyiapkan…" : "Login dengan Google"}
      </Button>
      {!hasEnvClient && !config.isLoading && (
        <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
          Server belum membaca Client ID (restart <code className="font-mono">bun run dev</code> setelah isi .env),
          atau isi manual di bawah — login tetap bisa jalan.
        </p>
      )}
      <div className="mt-3">
        <button type="button" className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={() => setShowCustom((v) => !v)}>
          {showCustom ? "Sembunyikan isian manual" : "Isi Client ID/Secret manual"}
        </button>
        {showCustom && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-medium" htmlFor={`g-cid-${kind}`}>
              <span>OAuth Client ID</span>
              <Input id={`g-cid-${kind}`} type="password" autoComplete="off" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="xxx.apps.googleusercontent.com" />
            </label>
            <label className="space-y-1.5 text-xs font-medium" htmlFor={`g-csec-${kind}`}>
              <span>OAuth Client Secret</span>
              <Input id={`g-csec-${kind}`} type="password" autoComplete="new-password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="GOCSPX-..." />
            </label>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Redirect: <code className="font-mono">{config.data?.redirectHint ?? "/api/integrations/google/callback"}</code></p>
    </div>
  );
}

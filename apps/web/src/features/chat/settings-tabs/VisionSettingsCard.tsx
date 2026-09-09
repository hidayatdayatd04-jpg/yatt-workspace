import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KIND_OPTIONS, VisionSettingsForm, type VisionStatus } from "./VisionSettingsFields";

/** Kartu konfigurasi provider Vision (Settings → Provider AI): logika + state. */
export function VisionSettingsCard() {
  const [status, setStatus] = useState<VisionStatus | null>(null);
  const [kind, setKind] = useState("gemini");
  const [baseUrl, setBaseUrl] = useState(KIND_OPTIONS[0]!.defaultUrl);
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/vision-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: VisionStatus | null) => {
        if (!data) return;
        setStatus(data);
        if (data.configured) {
          setKind(data.kind ?? "gemini");
          setBaseUrl(data.baseUrl ?? "");
          setModel(data.model ?? "");
        }
      })
      .catch(() => {});
  }, []);

  function changeKind(next: string) {
    setKind(next);
    const option = KIND_OPTIONS.find((k) => k.value === next);
    if (option && (!baseUrl || KIND_OPTIONS.some((k) => k.defaultUrl === baseUrl))) setBaseUrl(option.defaultUrl);
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/vision-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, baseUrl, model, ...(apiKey ? { apiKey } : {}) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? "Gagal menyimpan konfigurasi vision.");
      }
      const data = (await res.json()) as { updatedAt: string };
      setStatus({ configured: true, kind, baseUrl, model, updatedAt: data.updatedAt });
      setApiKey("");
      toast.success("Konfigurasi vision disimpan.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Hapus konfigurasi vision? Pembaca gambar akan kembali otomatis mendeteksi model.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/vision-settings", { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus.");
      setStatus({ configured: false, kind: null, baseUrl: null, model: null, updatedAt: null });
      setModel("");
      setApiKey("");
      toast.success("Konfigurasi vision dihapus.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setBusy(false);
    }
  }

  return VisionSettingsForm({ status, kind, baseUrl, model, apiKey, busy, setKind: changeKind, setBaseUrl, setModel, setApiKey, save, remove });
}

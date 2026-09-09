import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell } from "@/components/icons";

interface WatcherSettings {
  watcherEnabled: boolean;
  intervalMs: number;
}

const INTERVALS = [
  { value: 60_000, label: "Tiap 1 menit" },
  { value: 120_000, label: "Tiap 2 menit" },
  { value: 180_000, label: "Tiap 3 menit" },
  { value: 300_000, label: "Tiap 5 menit" },
  { value: 600_000, label: "Tiap 10 menit" },
];

export function MonitoringTab() {
  const [settings, setSettings] = useState<WatcherSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/monitoring/settings/watcher")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setSettings(data as WatcherSettings);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(next: WatcherSettings) {
    setSettings(next);
    setSaving(true);
    try {
      const res = await fetch("/api/monitoring/settings/watcher", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("Gagal menyimpan.");
      setSettings((await res.json()) as WatcherSettings);
      toast.success("Pengaturan monitoring disimpan.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="rounded-2xl border border-border/70 bg-card/60 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
            <Bell className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Monitoring Proaktif</h2>
            <p className="text-xs text-muted-foreground">Pantau router otomatis dan kirim notifikasi saat ambang terlampaui.</p>
          </div>
        </div>
        {!settings ? (
          <p className="text-xs text-muted-foreground">Memuat pengaturan…</p>
        ) : (
          <>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-4 py-3">
              <span className="text-sm font-medium">Pantau otomatis saat aplikasi berjalan</span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.watcherEnabled}
                disabled={saving}
                onClick={() => void save({ ...settings, watcherEnabled: !settings.watcherEnabled })}
                className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${settings.watcherEnabled ? "bg-indigo-500" : "bg-muted-foreground/25"}`}
              >
                <span className={`size-5 rounded-full bg-white shadow-sm transition-transform ${settings.watcherEnabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Interval pemeriksaan
              <select
                value={String(settings.intervalMs)}
                disabled={saving || !settings.watcherEnabled}
                onChange={(e) => void save({ ...settings, intervalMs: Number(e.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground"
              >
                {INTERVALS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[11px] leading-relaxed text-muted-foreground/80">
              Notifikasi muncul di ikon lonceng tanpa membuka dashboard. Duplikat kondisi yang sama dibatasi otomatis.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

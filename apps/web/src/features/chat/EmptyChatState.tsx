import { useEffect, useState } from "react";
import { loadRecentPrompts } from "./composer/prompt-library";

const STARTERS = [
  "Cek status semua interface",
  "Diagnosis kenapa internet lambat",
  "Bandingkan hAP ax² vs hEX",
  "Buat VLAN baru untuk tamu",
  "Cek penggunaan CPU dan memori",
  "Ringkas konfigurasi firewall",
];

const CHECKLIST_KEY = "onboarding-checklist-dismissed";

interface ChecklistState {
  hasConnector: boolean | null;
  hasProviderKey: boolean | null;
}

export function EmptyChatState(props: { onSelect?: (prompt: string) => void } = {}) {
  const [recent, setRecent] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<ChecklistState>({ hasConnector: null, hasProviderKey: null });
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(CHECKLIST_KEY) === "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    setRecent(loadRecentPrompts());
    let cancelled = false;
    Promise.all([
      fetch("/api/connectors").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/ai-provider").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([conns, providers]) => {
        if (cancelled) return;
        const connList = Array.isArray(conns?.connectors) ? conns.connectors : Array.isArray(conns) ? conns : [];
        const provList = Array.isArray(providers?.providers) ? providers.providers : Array.isArray(providers) ? providers : [];
        setChecklist({
          hasConnector: connList.length > 0 ? true : false,
          hasProviderKey: provList.some((p: { hasKey?: boolean }) => p?.hasKey) ? true : false,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(CHECKLIST_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  const steps = [
    { done: checklist.hasConnector === true, label: "Hubungkan connector", href: "/connectors" },
    { done: checklist.hasProviderKey === true, label: "Isi API key AI", href: "/settings/providers" },
    { done: false, label: "Kirim diagnosis pertama", href: null as string | null },
  ];
  const showChecklist = !dismissed && (checklist.hasConnector === false || checklist.hasProviderKey === false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Apa yang ingin Anda kerjakan?</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Pilih connector lewat menu (+) — hanya yang terdaftar yang tampil — atau langsung tanya jawab umum.
      </p>
      {showChecklist && (
        <div className="mt-4 w-full max-w-md rounded-2xl border border-border/70 bg-card/80 p-4 text-left shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">Mulai dalam 3 langkah</p>
            <button type="button" onClick={dismiss} aria-label="Tutup panduan" className="rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">
              Nanti
            </button>
          </div>
          <ol className="mt-2 space-y-1.5">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-xs">
                <span className={`flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${s.done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                  {s.done ? "✓" : "·"}
                </span>
                {s.href ? (
                  <a href={s.href} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                    {s.label}
                  </a>
                ) : (
                  <span className="text-muted-foreground">{s.label} — pilih salah satu contoh di bawah</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="mt-5 flex max-w-lg flex-wrap items-center justify-center gap-2">
        {STARTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => props.onSelect?.(s)}
            className="rounded-full border border-border/70 bg-card/80 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:border-indigo-500/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
      {recent.length > 0 && (
        <div className="mt-3 flex max-w-lg flex-wrap items-center justify-center gap-2">
          <span className="w-full text-[11px] text-muted-foreground/80">Terakhir ditanyakan:</span>
          {recent.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => props.onSelect?.(s)}
              title={s}
              className="max-w-[220px] truncate rounded-full border border-dashed border-border/70 bg-transparent px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:border-indigo-500/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

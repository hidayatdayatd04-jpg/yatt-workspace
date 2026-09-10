import { Eye, Trash2 } from "@/components/icons";
import { Button } from "@/components/ui/button";

export const KIND_OPTIONS = [
  { value: "gemini", label: "Google Gemini", defaultUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { value: "openrouter", label: "OpenRouter", defaultUrl: "https://openrouter.ai/api/v1" },
  { value: "custom", label: "Custom (OpenAI-compatible)", defaultUrl: "http://localhost:11434/v1" },
];

export interface VisionStatus {
  configured: boolean;
  kind: string | null;
  baseUrl: string | null;
  model: string | null;
  updatedAt: string | null;
}

/** Form render kartu vision (pemisahan murni agar tiap file ≤149 baris). */
export function VisionSettingsForm(props: {
  status: VisionStatus | null;
  kind: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  busy: boolean;
  setKind: (next: string) => void;
  setBaseUrl: (next: string) => void;
  setModel: (next: string) => void;
  setApiKey: (next: string) => void;
  save: () => Promise<void>;
  remove: () => Promise<void>;
}) {
  const { status } = props;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-7 space-y-6">
      <Header status={status} busy={props.busy} onRemove={() => void props.remove()} />
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-xs font-medium">
          Jenis provider
          <select value={props.kind} onChange={(e) => props.setKind(e.target.value)} className="mt-1 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm">
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Model vision
          <input value={props.model} onChange={(e) => props.setModel(e.target.value)} placeholder="mis. gemini-2.0-flash" maxLength={255} className="mt-1 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70" />
        </label>
        <label className="text-xs font-medium sm:col-span-2">
          Base URL
          <input value={props.baseUrl} onChange={(e) => props.setBaseUrl(e.target.value)} placeholder="https://…" maxLength={512} className="mt-1 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70" />
        </label>
        <label className="text-xs font-medium sm:col-span-2">
          API key {status?.configured && <span className="text-muted-foreground">(tersimpan — kosongkan agar tidak berubah)</span>}
          <input type="password" value={props.apiKey} onChange={(e) => props.setApiKey(e.target.value)} placeholder={status?.configured ? "••••••••" : "wajib diisi saat pertama kali"} maxLength={256} className="mt-1 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <Button size="sm" disabled={props.busy || !props.model || !props.baseUrl || (!props.apiKey && !status?.configured)} onClick={() => void props.save()}>
          Simpan konfigurasi vision
        </Button>
        {status?.configured && <span className="text-[11px] text-muted-foreground">Aktif: {status.model}</span>}
      </div>
    </div>
  );
}

function Header(props: { status: VisionStatus | null; busy: boolean; onRemove: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
          <Eye className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Pemahaman gambar</h2>
          <p className="text-xs text-muted-foreground">Dipakai otomatis untuk membaca lampiran gambar bila model utama tidak mendukung vision.</p>
        </div>
      </div>
      {props.status?.configured && (
        <Button variant="outline" size="sm" disabled={props.busy} onClick={props.onRemove}>
          <Trash2 className="size-3.5" /> Hapus
        </Button>
      )}
    </div>
  );
}

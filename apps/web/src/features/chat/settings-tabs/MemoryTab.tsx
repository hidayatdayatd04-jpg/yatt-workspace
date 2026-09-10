import { Brain, Trash2 } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useMemoryTab } from "./use-memory-tab";

export function MemoryTab() {
  const tab = useMemoryTab();
  const { memories, busy, instructions, draft, setDraft, savingInstructions } = tab;
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="rounded-2xl border border-border/70 bg-card/60 p-6 space-y-3">
        <h2 className="text-base font-semibold">Instruksi Khusus</h2>
        <p className="text-xs text-muted-foreground">Gaya jawaban yang selalu dipatuhi AI (mis. ringkas, bahasa Inggris, mode NOC). Maks 2000 karakter.</p>
        {instructions === null ? (
          <p className="text-xs text-muted-foreground">Memuat…</p>
        ) : (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Contoh: Jawab selalu ringkas dengan tabel. Utamakan perintah RouterOS lengkap."
              className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={savingInstructions || draft === instructions} onClick={() => void tab.saveInstructions()}>
                Simpan instruksi
              </Button>
              <span className="text-[11px] text-muted-foreground">{draft.length}/2000</span>
            </div>
          </>
        )}
      </div>
      <div className="rounded-2xl border border-border/70 bg-card/60 p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
              <Brain className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Memori Lintas Percakapan</h2>
              <p className="text-xs text-muted-foreground">Fakta yang diingat AI antar chat. Kredensial tidak pernah disimpan.</p>
            </div>
          </div>
          {!!memories?.length && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void tab.clearAll()}>
              Hapus semua
            </Button>
          )}
        </div>
        {memories === null ? (
          <p className="text-xs text-muted-foreground">Memuat memori…</p>
        ) : memories.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada memori. Fakta penting dari percakapan akan muncul di sini.</p>
        ) : (
          <ul className="space-y-2">
            {memories.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-3.5 py-2.5">
                <span className="text-xs leading-relaxed">{m.content}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void tab.remove(m.id)}
                  aria-label="Hapus memori"
                  title="Hapus memori"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

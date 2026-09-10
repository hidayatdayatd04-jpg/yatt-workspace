import { Sun, Moon, Check, Palette } from "@/components/icons";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { usePreferences, useSavePreferences } from "@/features/chat/chat-hooks";

export function AppearanceSection() {
  const prefs = usePreferences();
  const save = useSavePreferences();
  const theme = prefs.data?.theme ?? "system";
  function setTheme(next: "light" | "dark" | "system") {
    if (next === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else if (next === "light") {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      localStorage.removeItem("theme");
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    }
    save.mutate({ theme: next }, { onError: (err) => toast.error(err.message) });
  }
  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-6">
      <h2 className="text-base font-semibold">Tema workspace</h2>
      <p className="text-sm text-muted-foreground">Pilih suasana yang nyaman. Tema tersimpan di akun Anda.</p>
      <div className="grid grid-cols-3 gap-3 pt-2">
        {(["light", "dark", "system"] as const).map((t) => (
          <button type="button" key={t} aria-pressed={theme === t} disabled={save.isPending} onClick={() => setTheme(t)} className={`overflow-hidden rounded-xl border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring ${theme === t ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-muted-foreground"}`}>
            <div aria-hidden="true" className={`mb-3 flex h-24 overflow-hidden rounded-lg border sm:h-32 ${t === "dark" ? "border-slate-700 bg-slate-900" : t === "light" ? "border-slate-200 bg-white" : "border-slate-300 bg-linear-to-r from-white from-50% to-slate-900 to-50%"}`}><div className="w-1/4 border-r border-slate-400/20 bg-slate-400/10" /><div className="flex flex-1 flex-col justify-center gap-2 p-3"><span className="h-2 w-3/4 rounded bg-slate-400/40" /><span className="h-2 rounded bg-slate-400/20" /><span className="h-2 w-1/2 rounded bg-slate-400/20" /></div></div>
            <span className="flex items-center gap-2 px-1 pb-1 text-xs font-medium">{t === "light" ? <Sun className="size-3.5" /> : t === "dark" ? <Moon className="size-3.5" /> : <Palette className="size-3.5" />}{t === "light" ? "Terang" : t === "dark" ? "Gelap" : "Sistem"}{theme === t && <Check className="ml-auto size-3.5" />}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div>
          <p className="text-sm font-medium">Sidebar ringkas default</p>
          <p className="text-xs text-muted-foreground">Beri ruang lebih luas untuk percakapan.</p>
        </div>
        <Switch
          checked={!!prefs.data?.sidebarCollapsed}
          onCheckedChange={(v) => save.mutate({ sidebarCollapsed: v })}
          aria-label="Sidebar ringkas"
        />
      </div>
    </div>
  );
}

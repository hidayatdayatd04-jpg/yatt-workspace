import { useState } from "react";
import { ArrowLeft, Plug, Key, User, Palette, Database, ShieldCheck, Archive, Info, HelpCircle, Globe, Brain, Bell, Search } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { navigate } from "@/lib/router";
import { ProvidersSection } from "./sections/ProvidersSection";
import { ProfileSection } from "./sections/ProfileSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { ContextSection } from "./sections/ContextSection";
import { SecuritySection } from "./sections/SecuritySection";
import { ArchiveSection } from "./sections/ArchiveSection";
import { AboutSection } from "./sections/AboutSection";
import { HelpSection } from "./sections/HelpSection";
import { WebSearchSection } from "./sections/WebSearchSection";
import { MemoryTab } from "@/features/chat/settings-tabs/MemoryTab";
import { MonitoringTab } from "@/features/chat/settings-tabs/MonitoringTab";
import { ConnectorsManagePanel } from "@/features/connectors/ConnectorsManagePanel";
import "./settings.css";

const NAV = [
  { id: "providers", group: "Settings", label: "Model & vision", description: "Pilih model untuk percakapan, penalaran, dan pemahaman gambar.", icon: Key },
  { id: "profile", group: "Settings", label: "Profil", description: "Kelola identitas akun dan nama yang ditampilkan di workspace.", icon: User },
  { id: "security", group: "Settings", label: "Keamanan", description: "Lindungi akun dan pahami izin tindakan agent serta Safe Mode MikroTik.", icon: ShieldCheck },
  { id: "memory", group: "Settings", label: "Memori & instruksi", description: "Atur bagaimana agent memahami preferensi dan cara kerja Anda.", icon: Brain },
  { id: "context", group: "Settings", label: "Konteks percakapan", description: "Jaga percakapan panjang tetap relevan dengan peringkasan otomatis.", icon: Database },
  { id: "web-search", group: "Settings", label: "Riset web", description: "Hubungkan sumber pencarian untuk jawaban dengan informasi terkini.", icon: Globe },
  { id: "monitoring", group: "Settings", label: "Monitoring MikroTik", description: "Atur pemeriksaan berkala untuk router yang Anda hubungkan.", icon: Bell },
  { id: "appearance", group: "Customize", label: "Tampilan", description: "Sesuaikan tema dan ruang kerja agar nyaman digunakan setiap hari.", icon: Palette },
  { id: "connectors", group: "Customize", label: "Connectors", description: "Kelola koneksi aplikasi dan router Anda.", icon: Plug },
  { id: "archive", group: "Customize", label: "Arsip percakapan", description: "Temukan kembali percakapan yang telah Anda arsipkan.", icon: Archive },
  { id: "about", group: "Customize", label: "Tentang aplikasi", description: "Informasi versi dan kesehatan layanan workspace Anda.", icon: Info },
  { id: "help", group: "Customize", label: "Bantuan", description: "Mulai bekerja dengan model AI, connectors, dan tools agent.", icon: HelpCircle },
];

export function SettingsShell(props: { section: string; autoAdd?: boolean; onBack: () => void }) {
  const current = NAV.find((n) => n.id === props.section) ?? NAV[0]!;
  const section = current.id;
  const [navQuery, setNavQuery] = useState("");
  function open(id: string) { navigate({ name: "settings", section: id }); }
  const filtered = NAV.filter((n) => n.label.toLowerCase().includes(navQuery.toLowerCase()));
  return <div className="settings-workspace flex h-full w-full overflow-hidden bg-background">
    <aside className="hidden w-[264px] shrink-0 flex-col border-r border-border/70 bg-card/50 md:flex">
      <div className="px-4 pb-3 pt-4">
        <Button variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground" onClick={props.onBack}><ArrowLeft className="size-4" /> Kembali ke workspace</Button>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input value={navQuery} onChange={(e) => setNavQuery(e.target.value)} placeholder="Search" aria-label="Cari pengaturan" className="h-9 rounded-xl bg-background pl-9 text-sm" />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6" aria-label="Pengaturan">
        {(["Settings", "Customize"] as const).map((group) => {
          const items = filtered.filter((n) => n.group === group);
          if (items.length === 0) return null;
          return <div key={group} className="mb-4"><p className="px-3 pb-1.5 text-xs text-muted-foreground">{group}</p><div className="space-y-0.5">{items.map((n) => { const Icon = n.icon; const active = n.id === section; return <button key={n.id} type="button" onClick={() => open(n.id)} aria-current={active ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring ${active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}><Icon className="size-4 shrink-0" /><span className="flex-1">{n.label}</span></button>; })}</div></div>;
        })}
      </nav>
      <div className="border-t border-border/70 px-6 py-4 text-xs text-muted-foreground">YATT Agent <span className="float-right font-mono">v0.1</span></div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-3 md:hidden"><Button variant="ghost" size="sm" onClick={props.onBack} aria-label="Kembali ke chat"><ArrowLeft className="size-4" /></Button><select value={section} onChange={(e) => open(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm" aria-label="Halaman pengaturan">{NAV.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select></div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1060px] px-5 py-8 sm:px-10 sm:py-10 lg:px-14">
          {section === "connectors" ? (
            <div className="settings-content" key={section}>
              <ConnectorsManagePanel autoBrowse={props.autoAdd} />
            </div>
          ) : (
            <>
              <header className="mb-8 border-b border-border/70 pb-7"><p className="mb-3 text-xs font-medium text-muted-foreground">Pengaturan <span className="mx-2 opacity-50">/</span> {current.group}</p><h2 className="text-3xl font-semibold tracking-tight">{current.label}</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{current.description}</p></header>
              <div className="settings-content" key={section}>
                {section === "providers" && <ProvidersSection />}
                {section === "web-search" && <WebSearchSection />}
                {section === "memory" && <MemoryTab />}
                {section === "monitoring" && <MonitoringTab />}
                {section === "profile" && <ProfileSection />}
                {section === "appearance" && <AppearanceSection />}
                {section === "context" && <ContextSection />}
                {section === "security" && <SecuritySection />}
                {section === "archive" && <ArchiveSection />}
                {section === "about" && <AboutSection />}
                {section === "help" && <HelpSection />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  </div>;
}

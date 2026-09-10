import { useQuery } from "@tanstack/react-query";
import { AboutTab } from "@/features/chat/settings-tabs/AboutTab";
import { apiFetch } from "@/lib/api";

export function AboutSection() {
  const diag = useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch<{ status: string; checks: { database: string } }>("/health/ready"),
    retry: 1,
  });
  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-6">
      <h2 className="text-base font-semibold">Tentang dan diagnostik</h2>
      <p className="text-sm text-muted-foreground">YATT Agent v0.1.0 — coding, file, riset, dan aplikasi dalam satu percakapan. MikroTik tersedia sebagai connector dengan proteksi Safe Mode.</p>
      <p className="font-mono text-xs">
        DB: {diag.data?.checks.database ?? "…"} · status {diag.data?.status ?? "…"}
      </p>
      <AboutTab />
    </div>
  );
}

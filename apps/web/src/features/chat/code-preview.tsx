import { X } from "@/components/icons";
import { Button } from "@/components/ui/button";

/** Scrollbar ramping di dalam dokumen pratinjau agar seragam dengan kanvas kode. */
const PREVIEW_SCROLL_STYLE = `<style>html{scrollbar-width:thin;scrollbar-color:rgba(128,128,128,.45) transparent}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(128,128,128,.35);border-radius:9999px}</style>`;

/** Dokumen pratinjau: kode + gaya scrollbar (style di akhir tetap diterapkan browser). */
export function previewDoc(code: string): string {
  return `${code}${PREVIEW_SCROLL_STYLE}`;
}

export function CodePreviewOverlay({ code, label, onClose }: { code: string; label: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background/95 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label={`Pratinjau ${label}`}
    >
      <div className="mb-2 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{label} · Pratinjau</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          onClick={onClose}
          title="Tutup pratinjau"
          aria-label="Tutup pratinjau"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div
        className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe title="Pratinjau layar penuh" sandbox="allow-scripts" srcDoc={previewDoc(code)} className="h-full w-full border-0 bg-white" />
      </div>
    </div>
  );
}

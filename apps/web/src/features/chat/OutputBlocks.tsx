import { useState } from "react";
import { Check, Copy, Send } from "@/components/icons";
import { Button } from "@/components/ui/button";

export function CodeBlock({ language, code, onSendToTerminal }: { language: string; code: string; onSendToTerminal?: (code: string) => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-3 py-1.5 text-xs">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language || "Code"}</span>
        <div className="flex items-center gap-1">
          {onSendToTerminal && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => onSendToTerminal(code)}
              title="Isi draft terminal saja (tidak langsung dieksekusi)"
            >
              <Send className="size-3" />
              Kirim ke terminal
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* ignore */
              }
            }}
          >
            {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            {copied ? "Tersalin" : "Salin"}
          </Button>
        </div>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      <p className="border-t border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground">Contoh/script — belum berarti dieksekusi.</p>
    </div>
  );
}

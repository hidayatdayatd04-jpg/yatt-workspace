import { useCodeFollow } from "./use-code-follow";
import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2 } from "@/components/icons";
import { FileIcon } from "@/components/file-icons";
import { Button } from "@/components/ui/button";
import { ExpandIcon, HighlightedHtml, PlayIcon } from "./code-block-parts";
import { CodePreviewOverlay, previewDoc } from "./code-preview";

export function CodeBlock({ language, code, live, fileName }: { language: string; code: string; live?: boolean; fileName?: string }) {
  const codeScroll = useCodeFollow(code, live);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"code" | "preview">("code");
  const [full, setFull] = useState(false);
  const lang = language.trim().toLowerCase();
  const looksHtmlDoc = /<!doctype html|<\s*html[\s>]/i.test(code);
  const htmlLike = lang === "html" || lang === "svg" || lang === "xml" || looksHtmlDoc;
  const runnable = lang === "html" || lang === "svg" || looksHtmlDoc;
  const label = looksHtmlDoc && (lang === "" || lang === "code") ? "HTML" : language || "Code";
  const inPreview = view === "preview" && runnable;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* abaikan */
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-border/70 bg-muted/30 shadow-xs">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {live ? (
            <span role="status" aria-label="AI sedang menulis kode">
              <Loader2 className="size-3.5 animate-spin text-indigo-500 motion-reduce:animate-none" />
            </span>
          ) : fileName ? (
            <FileIcon fileName={fileName} size={14} />
          ) : (
            <ExternalLink className="size-3.5" aria-hidden="true" />
          )}
          <span className="font-mono uppercase tracking-wide">{label}</span>
        </span>
        <span className="flex items-center gap-0.5 rounded-full bg-muted/70 p-0.5">
          {runnable && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={`size-7 rounded-full ${view === "code" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setView("code")}
                title="Lihat kode"
                aria-label="Lihat kode"
              >
                <span aria-hidden="true" className="font-mono text-[11px] font-bold">{"</>"}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`size-7 rounded-full ${inPreview ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setView("preview")}
                title="Jalankan pratinjau"
                aria-label="Jalankan pratinjau"
              >
                <PlayIcon className="size-3.5" />
              </Button>
            </>
          )}
          {inPreview ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setFull(true)}
              title="Layar penuh"
              aria-label="Pratinjau layar penuh"
            >
              <ExpandIcon className="size-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => void copy()}
              title={copied ? "Tersalin" : "Salin kode"}
              aria-label={copied ? "Tersalin" : "Salin kode"}
            >
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            </Button>
          )}
        </span>
      </div>
      {inPreview ? (
        <iframe
          title="Pratinjau"
          sandbox="allow-scripts"
          srcDoc={previewDoc(code)}
          className="h-[320px] w-full border-0 bg-white"
        />
      ) : (
        <pre ref={codeScroll.ref} onScroll={codeScroll.onScroll} className="max-h-[420px] overflow-auto px-4 pb-4 pt-1 font-mono text-xs leading-relaxed">
          <code>{htmlLike ? <HighlightedHtml code={code} /> : code}</code>
        </pre>
      )}
      {full && inPreview && <CodePreviewOverlay code={code} label={label} onClose={() => setFull(false)} />}
    </div>
  );
}

import { useRef, useState } from "react";
import { Check, Copy, FileText } from "@/components/icons";
import { FileIcon } from "@/components/file-icons";
import { Markdown } from "./Markdown";
import type { CodeArtifactData } from "./code-artifact-data";

function downloadText(file: CodeArtifactData) {
  const url = URL.createObjectURL(new Blob([file.code], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.path.replaceAll("\\", "/").split("/").at(-1) || "dokumen.txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Canvas teks: dokumen/prompt/.md hasil AI — bukan canvas kode. */
export function TextCanvas({ artifact, live = false }: { artifact: CodeArtifactData; live?: boolean }) {
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const name = artifact.path.replaceAll("\\", "/").split("/").at(-1) ?? artifact.path;
  const isMarkdown = artifact.language === "markdown" || name.endsWith(".md");

  async function copy() {
    try {
      await navigator.clipboard.writeText(artifact.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* abaikan */ }
  }

  return (
    <section aria-label={`Hasil teks ${artifact.path}`} className="min-w-0">
      <div className="my-3 overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-xs">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-1.5">
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FileIcon fileName={name} size={14} />
            <span className="truncate font-mono">{name}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {live && <FileText className="size-3.5 animate-pulse text-indigo-500 motion-reduce:animate-none" aria-hidden="true" />}
            <button type="button" onClick={() => void copy()} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Salin teks">
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              {copied ? "Tersalin" : "Salin"}
            </button>
            <button type="button" onClick={() => downloadText(artifact)} className="rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={`Unduh ${name}`}>
              Unduh
            </button>
          </span>
        </div>
        <div ref={bodyRef} className="max-h-96 overflow-y-auto px-4 py-3">
          {isMarkdown
            ? <div className="text-sm leading-relaxed"><Markdown text={artifact.code} /></div>
            : <pre className="whitespace-pre-wrap text-sm leading-relaxed">{artifact.code}</pre>}
        </div>
      </div>
    </section>
  );
}

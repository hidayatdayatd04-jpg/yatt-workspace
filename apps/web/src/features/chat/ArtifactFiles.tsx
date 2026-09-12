import { Download } from "@/components/icons";
import { FileIcon } from "@/components/file-icons";
import { downloadArtifact, type CodeArtifactData } from "./code-artifact";

/** Kartu file hasil dikelompokkan di akhir jawaban. */
export function ArtifactFiles({ files }: { files: CodeArtifactData[] }) {
  if (!files.length) return null;
  return (
    <div aria-label="File hasil" className="mt-4 grid gap-2 sm:grid-cols-2">
      {files.map((file) => (
        <button key={file.path} type="button" onClick={() => downloadArtifact(file)}
          aria-label={`Unduh ${file.path}`}
          className="group flex min-w-0 items-center gap-3 rounded-xl border border-border/80 bg-background p-3 text-left transition-colors hover:border-indigo-400/60 hover:bg-indigo-500/5 focus-visible:outline-2 focus-visible:outline-ring">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10"><FileIcon fileName={file.path} size={22} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium" title={file.path}>{file.path.replaceAll("\\", "/").split("/").at(-1)}</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">{file.language.toUpperCase()} · {new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(new Blob([file.code]).size / 1024)} KB</span>
          </span>
          <Download className="size-4 shrink-0 text-muted-foreground group-hover:text-indigo-600" />
        </button>
      ))}
    </div>
  );
}

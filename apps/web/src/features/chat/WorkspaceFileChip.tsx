import { Download } from "@/components/icons";
import { FileIcon } from "@/components/file-icons";

/** Tombol unduh file hasil kerja AI (docx/xlsx/zip/dll) langsung dari chat. */
export function WorkspaceFileChip({ path }: { path: string }) {
  const name = path.replaceAll("\\", "/").split("/").at(-1) ?? path;
  const href = `/api/workspace/download?path=${encodeURIComponent(path)}`;
  return (
    <div className="my-2">
      <a
        href={href}
        download={name}
        aria-label={`Unduh ${name}`}
        className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
      >
        <FileIcon fileName={name} size={14} />
        <span className="truncate font-mono">{name}</span>
        <Download className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="shrink-0 text-muted-foreground">Unduh</span>
      </a>
    </div>
  );
}

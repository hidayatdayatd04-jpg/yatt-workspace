import { FileText, X } from "@/components/icons";
import { fmtSize } from "../ChatPanel";
import type { AttachmentDTO } from "../chat-hooks";

export function ComposerAttachments(props: { attachments: AttachmentDTO[]; onRemoveAttachment: (id: string) => void }) {
  if (props.attachments.length === 0) return null;
  const isImage = (a: AttachmentDTO) => a.contentType.startsWith("image/") || a.contentKind === "image";
  return (
    <div className="mb-2.5 flex flex-wrap gap-2">
      {props.attachments.map((a) => (
        <span
          key={a.id}
          className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-card/90 px-2.5 py-1 text-xs shadow-xs"
          title={`${a.originalName} (${fmtSize(a.sizeBytes)})`}
        >
          {isImage(a) ? (
            <img src={`/api/attachments/files/${a.id}`} alt={a.originalName} loading="lazy" className="size-8 rounded-md object-cover" />
          ) : (
            <FileText className="size-3.5 text-indigo-500" />
          )}
          <span className="max-w-[160px] truncate font-medium">{a.originalName}</span>
          <span className="text-[11px] text-muted-foreground">{fmtSize(a.sizeBytes)}</span>
          <button
            type="button"
            onClick={() => props.onRemoveAttachment(a.id)}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label={`Hapus lampiran ${a.originalName}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Download } from "@/components/icons";
import { FileIcon } from "@/components/file-icons";
import type { AttachmentDTO } from "./chat-hooks/types";
import { ChatFilePreview } from "./ChatFilePreview";

type ChatFile = AttachmentDTO & { messageId?: string | null; createdAt?: string };
export function ChatFilesPanel(props: { conversationId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const files = useQuery({ queryKey: ["attachments", props.conversationId], enabled: props.open,
    queryFn: () => apiFetch<{ attachments: ChatFile[] }>(`/api/attachments/${props.conversationId}/files`), refetchInterval: props.open ? 5000 : false });
  const filtered = (files.data?.attachments ?? []).filter((file) => file.originalName.toLowerCase().includes(search.toLowerCase()));
  return <Sheet open={props.open} onOpenChange={props.onOpenChange}>
    <SheetContent className="w-full sm:max-w-lg">
      <SheetHeader><SheetTitle>File dalam percakapan</SheetTitle>
        <SheetDescription>Seluruh file dan gambar yang diunggah di chat ini. Pilih file untuk melihat isinya.</SheetDescription></SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
        <Input aria-label="Cari file dalam chat" placeholder="Cari nama file..." value={search} onChange={(event) => setSearch(event.target.value)} />
        {files.isPending && <p role="status">Memuat lampiran...</p>}
        {files.isError && <div role="alert"><p>{files.error.message}</p><Button variant="outline" onClick={() => void files.refetch()}>Coba lagi</Button></div>}
        <p className="text-xs text-muted-foreground">{filtered.length} file</p>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {!files.isPending && !files.isError && filtered.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada file yang cocok.</p>}
          {filtered.map((file) => <div key={file.id} className="space-y-3 rounded-xl border p-3">
            <div className="flex items-center gap-3">
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setSelected(selected === file.id ? null : file.id)} aria-expanded={selected === file.id}>
                {/^(image\/(png|jpeg|webp|gif))$/.test(file.contentType)
                  ? <img src={`/api/attachments/files/${file.id}`} alt="" loading="lazy" className="size-10 shrink-0 rounded-lg object-cover" />
                  : <FileIcon fileName={file.originalName} size={32} />}
                <span className="min-w-0"><span className="block break-all text-sm font-medium">{file.originalName}</span>
                  <span className="text-xs text-muted-foreground">{(file.sizeBytes / 1024).toFixed(1)} KB{file.messageId === null ? " - Belum dikirim" : ""}</span></span>
              </button>
              <a href={`/api/attachments/files/${file.id}`} download={file.originalName} aria-label={`Unduh ${file.originalName}`} className="rounded p-2 hover:bg-muted"><Download className="size-4" /></a>
            </div>
            {selected === file.id && <ChatFilePreview key={file.id} file={file} />}
          </div>)}
        </div>
      </div>
    </SheetContent>
  </Sheet>;
}

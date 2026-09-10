import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { AttachmentDTO } from "./chat-hooks/types";

type FileContent = { content?: string; kind: string; nextOffset: number | null;
  entries?: { name: string; sizeBytes: number; directory: boolean }[] };
export function ChatFilePreview({ file }: { file: AttachmentDTO }) {
  const [offset, setOffset] = useState(0);
  const [entry, setEntry] = useState("");
  const image = /^(image\/(png|jpeg|webp|gif))$/.test(file.contentType);
  const content = useQuery({ queryKey: ["attachment-content", file.id, offset, entry], enabled: !image,
    queryFn: () => apiFetch<FileContent>(`/api/attachments/files/${encodeURIComponent(file.id)}/content?offset=${offset}${entry ? `&entryPath=${encodeURIComponent(entry)}` : ""}`) });
  if (image) return <img src={`/api/attachments/files/${file.id}`} alt={file.originalName} className="max-h-80 w-full rounded-lg object-contain" />;
  return <div className="space-y-3">
    {entry && <Button variant="outline" size="sm" onClick={() => { setEntry(""); setOffset(0); }}>Kembali ke daftar ZIP</Button>}
    {entry && <p className="break-all text-xs font-medium">{entry}</p>}
    {content.isPending && <p role="status" className="text-sm">Membaca file...</p>}
    {content.isError && <p role="alert" className="text-sm text-destructive">{content.error.message}</p>}
    {content.data?.entries && <div className="max-h-72 space-y-1 overflow-auto">
      {content.data.entries.map((item) => <button key={item.name} disabled={item.directory}
        className="block w-full rounded p-2 text-left text-xs break-all hover:bg-muted disabled:text-muted-foreground"
        onClick={() => { setEntry(item.name); setOffset(0); }}>{item.directory ? "Folder: " : ""}{item.name}</button>)}
    </div>}
    {content.data?.content && <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs">{content.data.content}</pre>}
    <div className="flex gap-2">
      {offset > 0 && <Button size="sm" variant="outline" onClick={() => setOffset(0)}>Awal file</Button>}
      {content.data?.nextOffset != null && <Button size="sm" variant="outline" onClick={() => setOffset(content.data!.nextOffset!)}>Baca selanjutnya</Button>}
    </div>
  </div>;
}

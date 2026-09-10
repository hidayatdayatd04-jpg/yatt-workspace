import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { AttachmentDTO } from "../features/chat/chat-hooks";

const MAX_FILES = 4;
const MAX_BYTES = 10 * 1024 * 1024;

/** File lampiran yang dipilih sebelum chat ada (disimpan lokal sampai chat dibuat). */
export function usePendingFiles() {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const previewUrls = useMemo(() => {
    const map: Record<string, string> = {};
    pendingFiles.forEach((file, i) => {
      if (file.type.startsWith("image/")) {
        try {
          map[`local-${i}`] = URL.createObjectURL(file);
        } catch {
          /* ignore */
        }
      }
    });
    return map;
  }, [pendingFiles]);

  useEffect(() => {
    return () => {
      Object.values(previewUrls).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      });
    };
  }, [previewUrls]);

  function pickFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("File melebihi 10 MiB.");
      return;
    }
    setPendingFiles((prev) => {
      if (prev.length >= MAX_FILES) {
        toast.error("Maksimal 4 lampiran per pesan.");
        return prev;
      }
      return [...prev, file];
    });
  }

  function removeAttachment(id: string) {
    const index = Number(id.replace("local-", ""));
    if (!Number.isInteger(index)) return;
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const attachments: AttachmentDTO[] = pendingFiles.map((file, i) => ({
    id: `local-${i}`,
    originalName: file.name,
    contentType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    status: "local",
    contentKind: file.type.startsWith("image/") ? "image" : "file",
  }));

  return { pendingFiles, attachments, previewUrls, pickFile, removeAttachment, clear: () => setPendingFiles([]) };
}

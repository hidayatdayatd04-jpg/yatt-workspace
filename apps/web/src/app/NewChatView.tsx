import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useConnectors } from "../features/connectors/connector-hooks";
import { useCreateConversation, type AttachmentDTO } from "../features/chat/chat-hooks";
import { ChatComposer } from "../features/chat/ChatComposer";
import { apiForm } from "@/lib/api";
import { usePendingFiles } from "./use-pending-files";

export function NewChatView({
  draftKey,
  onCreated,
  createConversation,
}: {
  draftKey: string;
  onCreated: (id: string) => void;
  createConversation: ReturnType<typeof useCreateConversation>;
}) {
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(draftKey) ?? "";
    } catch {
      return "";
    }
  });
  const [pendingConnector, setPendingConnector] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("pending-connector");
    } catch {
      return null;
    }
  });
  const files = usePendingFiles();
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem("pending-connector");
    } catch {
      /* ignore */
    }
  }, []);
  const connectors = useConnectors();
  const selected =
    (pendingConnector !== null
      ? (connectors.data ?? []).find((c) => c.id === pendingConnector)
      : null) ??
    null;

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, text);
      sessionStorage.setItem("composer-draft", text);
    } catch {
      /* ignore */
    }
  }, [text, draftKey]);

  async function handleSend(message: string, model?: string, providerId?: string, reasoningEffort?: string) {
    const trimmed = message.trim();
    if (!trimmed || createConversation.isPending || uploading) return;
    try {
      sessionStorage.setItem("composer-draft", "");
    } catch {
      /* ignore */
    }
    try {
      const res = await createConversation.mutateAsync({ title: trimmed.slice(0, 40), connectionId: selected?.id ?? null });
      const uploadedIds: string[] = [];
      if (files.pendingFiles.length > 0) {
        setUploading(true);
        try {
          for (const file of files.pendingFiles) {
            const form = new FormData();
            form.append("file", file);
            const uploaded = await apiForm<{ attachment: AttachmentDTO }>(`/api/attachments/${res.conversation.id}/files`, form);
            uploadedIds.push(uploaded.attachment.id);
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Gagal mengunggah lampiran.");
          setUploading(false);
          onCreated(res.conversation.id);
          return;
        }
        setUploading(false);
        files.clear();
      }
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      try {
        sessionStorage.setItem(`pending-prompt-${res.conversation.id}`, trimmed);
        if (uploadedIds.length > 0) sessionStorage.setItem(`pending-attachments-${res.conversation.id}`, JSON.stringify(uploadedIds));
        if (selected) sessionStorage.setItem("pending-connector", selected.id);
        if (model) sessionStorage.setItem(`pending-model-${res.conversation.id}`, model);
        if (providerId) sessionStorage.setItem(`pending-provider-${res.conversation.id}`, providerId);
        if (reasoningEffort) sessionStorage.setItem(`pending-reasoning-${res.conversation.id}`, reasoningEffort);
      } catch {
        /* ignore */
      }
      onCreated(res.conversation.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat chat.");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex size-14 items-center justify-center">
          <img src="/logo.png" alt="YATT Agent" className="size-full object-contain drop-shadow-md transition-transform hover:scale-105" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Apa yang ingin Anda kerjakan?</h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">Tulis kode, olah file, cari informasi, atau bekerja dengan aplikasi yang Anda hubungkan.</p>
        <div className="mt-8 w-full max-w-2xl text-left">
          <ChatComposer
            running={createConversation.isPending || uploading}
            connector={selected}
            connectors={connectors.data ?? []}
            selectedConnectorId={selected?.id ?? null}
            onSelectConnector={setPendingConnector}
            attachments={files.attachments}
            previewUrls={files.previewUrls}
            uploading={uploading}
            externalText={text}
            onClearExternalText={() => setText("")}
            onPickFile={files.pickFile}
            onRemoveAttachment={files.removeAttachment}
            onSend={(t, _ids, m, p, r) => void handleSend(t, m, p, r)}
            onCancel={() => {}}
            onAddRouter={() => {
              try {
                localStorage.setItem(draftKey, text);
                sessionStorage.setItem("composer-draft", text);
              } catch {
                /* ignore */
              }
              const returnTo = window.location.pathname;
              window.location.href = `/connectors?add=1&returnTo=${encodeURIComponent(returnTo)}`;
            }}
            onCompact={() => toast.info("Buat chat dulu sebelum compact.")}
            draftKey={draftKey}
          />
        </div>
      </div>
    </div>
  );
}

import { toast } from "sonner";
import type { RefObject } from "react";
import type { useComposerDraft } from "./use-composer-draft";
import type { useComposerActions } from "./use-composer-actions";
import type { ChatComposerProps } from "./types";

const MAX_FILES = 4;

/** Textarea + hidden file input + drag/drop/paste/Ctrl+U. */
export function ComposerInput(props: {
  composer: ChatComposerProps;
  draft: ReturnType<typeof useComposerDraft>;
  actions: ReturnType<typeof useComposerActions>;
  uploadDisabled: boolean;
  text: string;
  setText: (v: string | ((prev: string) => string)) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const { composer, draft, actions, uploadDisabled } = props;

  function addFiles(files: File[]) {
    if (files.length === 0 || composer.uploading || uploadDisabled) return;
    const room = Math.max(0, MAX_FILES - composer.attachments.length);
    files.slice(0, room).forEach((f) => composer.onPickFile(f));
    if (files.length > room) toast.error("Maksimal 4 lampiran per pesan.");
  }

  return (
    <>
      <input
        ref={actions.fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.csv,.log,.rsc"
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <textarea
        ref={props.textareaRef}
        value={props.text}
        onChange={(e) => props.setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") {
            e.preventDefault();
            if (!uploadDisabled) actions.pickFile(false);
            return;
          }
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            draft.submit();
            return;
          }
          if (e.key === "Escape" && composer.running) {
            e.preventDefault();
            composer.onCancel();
            return;
          }
          draft.onKeyDown(e);
        }}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData?.files ?? []);
          if (files.length === 0) return;
          e.preventDefault();
          addFiles(files);
        }}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer.files ?? []);
          if (files.length === 0) return;
          e.preventDefault();
          addFiles(files);
        }}
        onDragOver={(e) => {
          if (composer.uploading || uploadDisabled) return;
          e.preventDefault();
        }}
        onCompositionStart={() => draft.setImeComposing(true)}
        onCompositionEnd={() => draft.setImeComposing(false)}
        placeholder="Tulis pesan…"
        aria-label="Pesan untuk AI"
        rows={1}
        disabled={composer.disabled}
        className="max-h-44 min-h-[38px] w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
      />
    </>
  );
}

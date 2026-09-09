import { Button } from "@/components/ui/button";
import { Send, Square } from "@/components/icons";
import { toast } from "sonner";
import { useConnectors } from "@/features/connectors/connector-hooks";
import { ContextMeter } from "./ContextMeter";
import { useComposerModel } from "./composer/use-composer-model";
import { useModelScroll } from "./composer/use-model-scroll";
import { useComposerDraft } from "./composer/use-composer-draft";
import { useComposerActions } from "./composer/use-composer-actions";
import { useComposerReasoning } from "./composer/use-composer-reasoning";
import { ReasoningPicker } from "./composer/ReasoningPicker";
import { ComposerMenu } from "./composer/ComposerMenu";
import { VoiceButton } from "./composer/VoiceButton";
import { saveRecentPrompt } from "./composer/prompt-library";
import { ModelPicker } from "./composer/ModelPicker";
import { ComposerAttachments } from "./composer/ComposerExtras";
import type { ChatComposerProps } from "./composer/types";

export function ChatComposer(props: ChatComposerProps) {
  const actions = useComposerActions({
    connector: props.connector,
    disabled: props.disabled,
    running: props.running,
    uploading: props.uploading,
    attachmentCount: props.attachments.length,
  });
  const { setMode, writeEnabled, uploadDisabled } = actions;

  const draft = useComposerDraft({
    draftKey: props.draftKey,
    externalText: props.externalText,
    onClearExternalText: props.onClearExternalText,
    canSubmit: () => !props.disabled && !props.running && !props.uploading && !setMode.isPending,
    onSend: (trimmed) => {
      saveRecentPrompt(trimmed);
      props.onSend(
        trimmed,
        props.attachments.map((a) => a.id),
        model.effectiveModel || undefined,
        model.effectiveSelection?.providerId,
        reasoning.effort,
      );
    },
  });
  const { text, setText, textareaRef } = draft;

  const model = useComposerModel(text, props.draftKey);
  const reasoning = useComposerReasoning(model.effectiveModel);
  const scroll = useModelScroll(model.modelMenuOpen, model.modelQuery, model.aiProviders.data);

  const fallbackConnectors = useConnectors();
  const connectors =
    props.connectors && props.connectors.length > 0
      ? props.connectors
      : (fallbackConnectors.data ?? (props.connector ? [props.connector] : []));
  const selectedId = props.selectedConnectorId ?? props.connector?.id ?? null;

  const isDocked = Boolean(props.conversationId);
  return (
    <div className={isDocked ? "border-t border-border/40 bg-background/80 backdrop-blur-md px-3 py-3 sm:px-6 sm:py-4" : "w-full"}>
      <div className={isDocked ? "mx-auto max-w-3xl" : "w-full"}>
        <ComposerAttachments attachments={props.attachments} onRemoveAttachment={props.onRemoveAttachment} />

        <div
          className="relative flex flex-col rounded-2xl border border-border/70 bg-card/95 p-2 shadow-sm transition-colors duration-200 hover:border-border"
          onDragOver={(e) => {
            if (props.uploading || uploadDisabled) return;
            e.preventDefault();
          }}
          onDrop={(e) => {
            if (props.uploading || uploadDisabled) return;
            const files = Array.from(e.dataTransfer.files ?? []);
            if (files.length === 0) return;
            e.preventDefault();
            const room = Math.max(0, 4 - props.attachments.length);
            files.slice(0, room).forEach((f) => props.onPickFile(f));
            if (files.length > room) toast.error("Maksimal 4 lampiran per pesan.");
          }}
        >
          <input
            ref={actions.fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.csv,.log,.rsc"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              const room = Math.max(0, 4 - props.attachments.length);
              files.slice(0, room).forEach((f) => props.onPickFile(f));
              if (files.length > room) toast.error("Maksimal 4 lampiran per pesan.");
              e.target.value = "";
            }}
          />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                draft.submit();
                return;
              }
              if (e.key === "Escape" && props.running) {
                e.preventDefault();
                props.onCancel();
                return;
              }
              draft.onKeyDown(e);
            }}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData?.files ?? []);
              if (files.length === 0 || props.uploading || uploadDisabled) return;
              e.preventDefault();
              const room = Math.max(0, 4 - props.attachments.length);
              files.slice(0, room).forEach((f) => props.onPickFile(f));
              if (files.length > room) toast.error("Maksimal 4 lampiran per pesan.");
            }}
            onCompositionStart={() => draft.setImeComposing(true)}
            onCompositionEnd={() => draft.setImeComposing(false)}
            placeholder="Tulis pesan…"
            aria-label="Pesan untuk AI"
            rows={1}
            disabled={props.disabled}
            className="max-h-44 min-h-[38px] w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
          />

          <div className="mt-1 flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <ComposerMenu
                uploading={props.uploading}
                running={props.running}
                connectors={connectors}
                selectedId={selectedId}
                onSelectConnector={props.onSelectConnector}
                onAddRouter={props.onAddRouter}
                uploadDisabled={uploadDisabled}
                onPickFile={actions.pickFile}
                writeEnabled={writeEnabled}
                onToggleWrite={actions.toggleWrite}
                writeDisabled={!props.connector || props.connector.status !== "connected" || setMode.isPending || props.running}
                onCompact={props.onCompact}
                connector={props.connector}
              />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <VoiceButton
                onTranscript={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))}
                disabled={props.disabled || props.running}
              />
              <ReasoningPicker reasoning={reasoning} />
              <ModelPicker model={model} scroll={scroll} />
              <ContextMeter
                conversationId={props.conversationId}
                running={props.running}
                providerId={model.effectiveSelection?.providerId ?? null}
                model={model.effectiveModel || undefined}
                providerName={model.effectiveProvider?.name}
              />
              <Button
                type="button"
                size="icon"
                className={`size-9 rounded-xl transition-colors ${props.running ? "bg-foreground text-background hover:bg-foreground/85" : "bg-indigo-600 text-white hover:bg-indigo-500"}`}
                onClick={props.running ? props.onCancel : draft.submit}
                disabled={props.running ? props.cancelling : props.disabled || props.uploading || setMode.isPending || !text.trim()}
                aria-label={props.running ? "Hentikan jawaban" : setMode.isPending ? "Menunggu mode router…" : "Kirim pesan"}
                title={props.running ? "Hentikan jawaban" : setMode.isPending ? "Menunggu mode router…" : "Kirim pesan"}
              >
                {props.running ? <Square className="size-3.5 fill-current" /> : <Send className="size-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function toastAttachmentError(msg: string) {
  toast.error(msg);
}

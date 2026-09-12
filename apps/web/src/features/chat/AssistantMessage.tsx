import { ArtifactFiles } from "./ArtifactFiles";
import { completedArtifacts } from "./artifact-events";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "@/components/icons";
import { FileIcon } from "@/components/file-icons";
import type { MessageDTO, ActivityEventDTO } from "./chat-hooks";
import { ToolGroup } from "./tool-cards";
import { AssistantTimeline } from "./AssistantTimeline";
import { AssistantBody } from "./AssistantBody";
import { CopyButton } from "./CopyButton";
import { FeedbackButtons } from "./FeedbackButtons";
import { ReasoningBlock } from "./ReasoningBlock";
import { RunErrorCard } from "./RunErrorCard";
import { useAssistantModel } from "./use-assistant-model";

export function AssistantMessage(props: {
  m: MessageDTO;
  messages: MessageDTO[];
  runActs: ActivityEventDTO[] | undefined;
  onAnswerAsk?: (label: string) => void;
  onResendPrompt?: (prompt: string) => void;
  /** Retry in-place: ulangi run memakai pesan user yang sudah ada. */
  onRetryMessage?: (messageId: string, text: string) => void;
  /** True saat ada run berjalan — aksi ubah/ulang dikunci. */
  actionsDisabled?: boolean;
  activeConnectionId?: string | null;
  conversationId?: string | null;
}) {
  const { m } = props;
  const model = useAssistantModel(props);
  const { pipeline, showPipeline, displayTimeline, overall, outcome, partialFailures, strippedText, showErrorCard, errorInfo, prevUser, showRegenerate } = model;

  return (
    <div>
      <div className="rounded-2xl rounded-tl-xs border border-border/70 bg-card/80 px-4 py-3.5 shadow-xs">
        {typeof outcome?.fallbackReason === "string" && outcome.fallbackReason && (
          <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
            Dijawab model cadangan ({outcome.fallbackReason}).
          </p>
        )}
        {!!m.content.reasoning && !displayTimeline?.some((b) => b.kind === "reasoning") && (
          <ReasoningBlock text={m.content.reasoning} live={false} />
        )}
        {m.content.attachments && m.content.attachments.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1">
            {m.content.attachments.map((a) =>
              a.kind === "image" ? (
                <a key={a.id} href={`/api/attachments/files/${a.id}`} target="_blank" rel="noreferrer" title={a.name}>
                  <img src={`/api/attachments/files/${a.id}`} alt={a.name} loading="lazy" className="h-20 w-20 rounded-lg border border-border/60 object-cover" />
                </a>
              ) : (
                <span key={a.id} className="flex items-center gap-1 rounded-md border border-border/80 bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <FileIcon fileName={a.name} size={12} />
                  {a.name}
                </span>
              ),
            )}
          </div>
        )}
        {displayTimeline ? (
          <AssistantTimeline
            blocks={displayTimeline}
            m={m}
            overall={overall}
            onAnswerAsk={props.onAnswerAsk}
            onResendPrompt={props.onResendPrompt}
            actionsDisabled={props.actionsDisabled}
            activeConnectionId={props.activeConnectionId}
            conversationId={props.conversationId}
          />
        ) : (
          <>
            {showPipeline && (
              <div className="mb-3">
                <ToolGroup
                  steps={pipeline!.steps}
                  runId={m.content.runId}
                  overall={overall}
                  onRetry={props.onResendPrompt ? () => props.onResendPrompt?.("continue") : undefined}
                />
              </div>
            )}
            {strippedText.chat ? (
              <AssistantBody
                text={strippedText.chat}
                onAnswerAsk={props.onAnswerAsk}
                activeConnectionId={props.activeConnectionId}
                conversationId={props.conversationId}
                onSelectPrompt={props.onResendPrompt}
                suggestionsDisabled={props.actionsDisabled}
              />
            ) : (
              !showErrorCard && (
                <span className="text-xs text-muted-foreground">
                  {m.status === "cancelled" ? "Jawaban dihentikan." : "Tidak ada teks jawaban."}
                </span>
              )
            )}
          </>
        )}
        {showErrorCard && errorInfo && (
          <div className={displayTimeline || strippedText.chat || showPipeline ? "mt-2.5" : ""}>
            <RunErrorCard error={errorInfo} onRetry={props.onResendPrompt ? () => props.onResendPrompt?.("continue") : undefined} />
          </div>
        )}
        {!showErrorCard && m.status && m.status !== "complete" && m.status !== "completed" && (
          <p className="mt-1 text-[11px] text-muted-foreground/80">
            Status: {m.status === "failed" ? "Gagal" : m.status === "cancelled" ? "Dibatalkan" : m.status}
          </p>
        )}
        <ArtifactFiles files={completedArtifacts(m.content.timeline ?? [])} />
        {partialFailures > 0 && (
          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">Sebagian pembacaan gagal ({partialFailures}) — jawaban mungkin tidak lengkap.</p>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-start gap-2 text-[11px] text-muted-foreground">
        {strippedText.chat && <CopyButton getText={() => strippedText.chat} label="Salin Jawaban" />}
        {strippedText.chat && !showErrorCard && (
          <FeedbackButtons messageId={m.id} conversationId={props.conversationId} disabled={props.actionsDisabled} />
        )}
        {showRegenerate && prevUser && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            onClick={() => {
              if (props.onRetryMessage) props.onRetryMessage(prevUser.id, prevUser.text);
              else props.onResendPrompt?.(prevUser.text);
            }}
            title="Ulangi jawaban ini"
            aria-label="Ulangi jawaban ini"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

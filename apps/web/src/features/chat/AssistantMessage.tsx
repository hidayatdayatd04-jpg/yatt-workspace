import { Button } from "@/components/ui/button";
import { FileText, RotateCcw } from "@/components/icons";
import type { MessageDTO, ActivityEventDTO } from "./chat-hooks";
import { buildRunTimeline, type TimelineBlock } from "./run-timeline";
import { RunPipeline, buildPipeline, ResearchCard } from "./ToolActivity";
import { AssistantBody } from "./AssistantBody";
import { CopyButton } from "./CopyButton";
import { FeedbackButtons } from "./FeedbackButtons";
import { ReasoningBlock } from "./ReasoningBlock";
import { RunErrorCard } from "./RunErrorCard";
import { splitLegacyFailureNotice, toRunErrorInfo } from "./run-error";

export function AssistantMessage(props: {
  m: MessageDTO;
  messages: MessageDTO[];
  runActs: ActivityEventDTO[] | undefined;
  onAnswerAsk?: (label: string) => void;
  onSendToTerminal?: (code: string) => void;
  onResendPrompt?: (prompt: string) => void;
  /** Retry in-place: ulangi run memakai pesan user yang sudah ada. */
  onRetryMessage?: (messageId: string, text: string) => void;
  /** True saat ada run berjalan — aksi ubah/ulang dikunci. */
  actionsDisabled?: boolean;
  activeConnectionId?: string | null;
  conversationId?: string | null;
}) {
  const { m } = props;
  const pipeline = props.runActs && props.runActs.length > 0 ? buildPipeline(props.runActs) : null;
  const showPipeline = !!pipeline && pipeline.steps.length > 0;
  const timeline = m.content.timeline?.length ? buildRunTimeline(m.content.timeline) : null;
  // Status run keseluruhan: pipeline tool yang selesai tidak boleh
  // berlabel "Selesai" bila jawaban akhirnya gagal/dibatalkan.
  const overall = m.status === "failed" ? ("failed" as const) : m.status === "cancelled" ? ("cancelled" as const) : null;
  const isFailedRun = m.status === "failed";

  // Detail error TIDAK ditampilkan sebagai chat: pisahkan notice format
  // lama dari teks, lalu tampilkan sebagai kartu error terstruktur.
  const outcome = (m.content.outcome ?? null) as {
    status?: string;
    code?: unknown;
    reason?: unknown;
    message?: unknown;
    toolSucceeded?: unknown;
    toolFailed?: unknown;
    fallbackReason?: unknown;
  } | null;
  const partialFailures =
    outcome?.status === "completed" && typeof outcome.toolFailed === "number" && outcome.toolFailed > 0
      ? outcome.toolFailed
      : 0;
  const strippedText = splitLegacyFailureNotice(m.content.text ?? "");
  let displayTimeline: TimelineBlock[] | null = timeline;
  let legacyNoticeFound = strippedText.hadNotice;
  if (timeline) {
    const mapped: TimelineBlock[] = [];
    for (const block of timeline) {
      if (block.kind !== "text") {
        mapped.push(block);
        continue;
      }
      const split = splitLegacyFailureNotice(block.text);
      if (split.hadNotice) legacyNoticeFound = true;
      if (split.chat) mapped.push({ ...block, text: split.chat });
    }
    displayTimeline = mapped.length > 0 ? mapped : null;
  }
  const showErrorCard = isFailedRun && (typeof outcome?.code === "string" || legacyNoticeFound);
  const errorInfo = showErrorCard
    ? toRunErrorInfo({
        code: outcome?.code,
        reason: outcome?.reason,
        message: outcome?.message,
        toolSucceeded: outcome?.toolSucceeded,
        toolFailed: outcome?.toolFailed,
      })
    : null;

  // Pesan user pemicu jawaban ini (untuk Regenerate in-place).
  const selfIdx = props.messages.findIndex((msg) => msg.id === m.id);
  const prevUser = (() => {
    for (let i = selfIdx - 1; i >= 0; i--) {
      const t = props.messages[i]?.content.text;
      if (props.messages[i]?.role === "user" && t) return { id: props.messages[i]!.id, text: t };
    }
    return null;
  })();
  // Regenerate hanya pada output AI PALING AKHIR — jawaban lama tidak bisa
  // diulang (riwayat di bawahnya sudah tidak valid bila diulang).
  const isLastAssistant =
    selfIdx >= 0 && !props.messages.slice(selfIdx + 1).some((mm) => mm.role === "assistant");
  const showRegenerate =
    !!prevUser &&
    isLastAssistant &&
    m.status !== "failed" &&
    m.status !== "cancelled" &&
    !props.actionsDisabled &&
    (!!props.onRetryMessage || !!props.onResendPrompt);

  return (
    <div>
      <div className="rounded-2xl rounded-tl-xs border border-border/70 bg-card/80 px-4 py-3.5 shadow-xs">
        {typeof outcome?.fallbackReason === "string" && outcome.fallbackReason && (
          <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
            Dijawab model cadangan ({outcome.fallbackReason}).
          </p>
        )}
        {!!m.content.reasoning && <ReasoningBlock text={m.content.reasoning} live={false} />}
        {m.content.attachments && m.content.attachments.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1">
            {m.content.attachments.map((a) =>
              a.kind === "image" ? (
                <a key={a.id} href={`/api/attachments/files/${a.id}`} target="_blank" rel="noreferrer" title={a.name}>
                  <img src={`/api/attachments/files/${a.id}`} alt={a.name} loading="lazy" className="h-20 w-20 rounded-lg border border-border/60 object-cover" />
                </a>
              ) : (
                <span
                  key={a.id}
                  className="flex items-center gap-1 rounded-md border border-border/80 bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  <FileText className="size-3 text-cyan-500" />
                  {a.name}
                </span>
              ),
            )}
          </div>
        )}

        {displayTimeline ? (
          displayTimeline.map((block) => (
            <div key={block.key} className="my-2 first:mt-0 last:mb-0">
              {block.kind === "text" ? (
                <AssistantBody
                  text={block.text}
                  onAnswerAsk={props.onAnswerAsk}
                  onSendToTerminal={props.onSendToTerminal}
                  activeConnectionId={props.activeConnectionId}
                  conversationId={props.conversationId}
                  onSelectPrompt={props.onResendPrompt}
                  suggestionsDisabled={props.actionsDisabled}
                />
              ) : block.kind === "research" ? (
                <ResearchCard research={block.research} status={block.status} />
              ) : (
                <RunPipeline steps={block.steps ?? [block.step]} defaultOpen={false} overall={overall} />
              )}
            </div>
          ))
        ) : (
          <>
            {showPipeline && (
              <div className="mb-3">
                <RunPipeline steps={pipeline!.steps} tx={pipeline!.tx} defaultOpen={false} overall={overall} />
              </div>
            )}
            {strippedText.chat ? (
              <AssistantBody
                text={strippedText.chat}
                onAnswerAsk={props.onAnswerAsk}
                onSendToTerminal={props.onSendToTerminal}
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
            <RunErrorCard
              error={errorInfo}
              onRetry={props.onResendPrompt ? () => props.onResendPrompt?.("continue") : undefined}
            />
          </div>
        )}

        {!showErrorCard && m.status && m.status !== "complete" && m.status !== "completed" && (
          <p className="mt-1 text-[11px] text-muted-foreground/80">
            Status: {m.status === "failed" ? "Gagal" : m.status === "cancelled" ? "Dibatalkan" : m.status}
          </p>
        )}
        {partialFailures > 0 && (
          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
            Sebagian pembacaan gagal ({partialFailures}) — jawaban mungkin tidak lengkap.
          </p>
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
              // Retry in-place: pakai ulang pesan user pemicu (teks sama),
              // jawaban ini diganti hasil baru — tanpa pesan duplikat.
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

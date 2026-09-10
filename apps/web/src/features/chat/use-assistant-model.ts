import { buildRunTimeline, type TimelineBlock } from "./run-timeline";
import { buildPipeline } from "./ToolActivity";
import { splitLegacyFailureNotice, toRunErrorInfo } from "./run-error";
import type { MessageDTO, ActivityEventDTO } from "./chat-hooks";

/** Turunan tampilan dari pesan assistant: pipeline, timeline, error, regenerate. */
export function useAssistantModel(props: {
  m: MessageDTO;
  messages: MessageDTO[];
  runActs: ActivityEventDTO[] | undefined;
  onRetryMessage?: (messageId: string, text: string) => void;
  onResendPrompt?: (prompt: string) => void;
  actionsDisabled?: boolean;
}) {
  const { m } = props;
  const pipeline = props.runActs && props.runActs.length > 0 ? buildPipeline(props.runActs) : null;
  const showPipeline = !!pipeline && pipeline.steps.length > 0;
  const timeline = m.content.timeline?.length ? buildRunTimeline(m.content.timeline) : null;
  const overall = m.status === "failed" ? ("failed" as const) : m.status === "cancelled" ? ("cancelled" as const) : null;
  const isFailedRun = m.status === "failed";

  const outcome = (m.content.outcome ?? null) as {
    status?: string; code?: unknown; reason?: unknown; message?: unknown;
    toolSucceeded?: unknown; toolFailed?: unknown; fallbackReason?: unknown;
  } | null;
  const partialFailures =
    outcome?.status === "completed" && typeof outcome.toolFailed === "number" && outcome.toolFailed > 0 ? outcome.toolFailed : 0;
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
    ? toRunErrorInfo({ code: outcome?.code, reason: outcome?.reason, message: outcome?.message, toolSucceeded: outcome?.toolSucceeded, toolFailed: outcome?.toolFailed })
    : null;

  // Pesan user pemicu jawaban ini (untuk Regenerate in-place pada output terakhir).
  const selfIdx = props.messages.findIndex((msg) => msg.id === m.id);
  const prevUser = (() => {
    for (let i = selfIdx - 1; i >= 0; i--) {
      const t = props.messages[i]?.content.text;
      if (props.messages[i]?.role === "user" && t) return { id: props.messages[i]!.id, text: t };
    }
    return null;
  })();
  const isLastAssistant = selfIdx >= 0 && !props.messages.slice(selfIdx + 1).some((mm) => mm.role === "assistant");
  const showRegenerate =
    !!prevUser && isLastAssistant && m.status !== "failed" && m.status !== "cancelled" &&
    !props.actionsDisabled && (!!props.onRetryMessage || !!props.onResendPrompt);

  return { pipeline, showPipeline, displayTimeline, overall, outcome, partialFailures, strippedText, showErrorCard, errorInfo, prevUser, showRegenerate };
}

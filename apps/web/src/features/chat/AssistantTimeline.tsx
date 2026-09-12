import type { MessageDTO } from "./chat-hooks";
import type { TimelineBlock } from "./run-timeline";
import type { RunOverall } from "./tool-activity/types";
import { ResearchCard } from "./ToolActivity";
import { ToolGroup } from "./tool-cards";
import { AssistantBody } from "./AssistantBody";
import { ReasoningBlock } from "./ReasoningBlock";
import { WorkspaceFileChip } from "./WorkspaceFileChip";
import { CodeArtifact } from "./code-artifact";

/** Render blok timeline pesan asisten (persisted). */
export function AssistantTimeline(props: {
  blocks: TimelineBlock[];
  m: MessageDTO;
  overall: RunOverall | null;
  onAnswerAsk?: (label: string) => void;
  onResendPrompt?: (prompt: string) => void;
  actionsDisabled?: boolean;
  activeConnectionId?: string | null;
  conversationId?: string | null;
}) {
  const { m } = props;
  const retryTool = props.onResendPrompt ? () => props.onResendPrompt?.("continue") : undefined;
  return (
    <>
      {props.blocks.map((block) => (
        <div key={block.key} className="my-2 first:mt-0 last:mb-0">
          {block.kind === "text" ? (
            <AssistantBody
              text={block.text}
              onAnswerAsk={props.onAnswerAsk}
              activeConnectionId={props.activeConnectionId}
              conversationId={props.conversationId}
              onSelectPrompt={props.onResendPrompt}
              suggestionsDisabled={props.actionsDisabled}
            />
          ) : block.kind === "reasoning" ? (
            <ReasoningBlock text={block.text} live={false} durationMs={block.durationMs} />
          ) : block.kind === "artifact" ? (
            <CodeArtifact artifact={block.artifact} />
          ) : block.kind === "file" ? (
            <WorkspaceFileChip path={block.path} />
          ) : block.kind === "research" ? (
            <ResearchCard research={block.research} status={block.status} activityLabel={block.activityLabel} />
          ) : (
            <ToolGroup steps={block.steps ?? [block.step]} runId={m.content.runId} overall={props.overall} onRetry={retryTool} />
          )}
        </div>
      ))}
    </>
  );
}

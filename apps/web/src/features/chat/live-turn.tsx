import { CodeArtifact } from "./code-artifact";
import { WorkspaceFileChip } from "./WorkspaceFileChip";
import { useMemo } from "react";
import { ThinkingLogo } from "./ThinkingLogo";
import { ReasoningBlock } from "./ReasoningBlock";
import { buildRunTimeline } from "./run-timeline";
import { ResearchCard, type PipelineStep } from "./ToolActivity";
import { ToolGroup } from "./tool-cards";
import { LiveTextBlock } from "./LiveTextBlock";
import type { RunEventDTO } from "./chat-hooks";

export function LiveTurn(props: {
  runLive: boolean;
  runId?: string | null;
  streamText: string;
  reasoningText?: string;
  liveEvents?: RunEventDTO[];
  liveSteps: PipelineStep[];
  queueStatus?: string | null;
  txStatus?: string | null;
}) {
  const { runLive, streamText, reasoningText, liveEvents, liveSteps } = props;
  // Bangun timeline sekali: event seperti run.started / provider.waiting /
  // transaction.updated TIDAK menghasilkan blok renderable. Bubble hanya boleh
  // tampil bila ada konten nyata, bukan sekadar "ada event". useMemo agar
  // rebuild + parse Markdown tidak diulang untuk render yang tidak terkait.
  const blocks = useMemo(
    () => (liveEvents?.length ? buildRunTimeline(liveEvents, true) : []),
    [liveEvents],
  );
  const hasRenderable = !!reasoningText || liveSteps.length > 0 || blocks.length > 0 || !!streamText;
  const showTurn = runLive && hasRenderable;
  const showThinking = runLive && !hasRenderable;
  const statusText = props.queueStatus ?? props.txStatus;
  return (
    <>
      {/* Live in-flight assistant turn */}
      {showTurn && (
        <div className="flex gap-3 justify-start animate-in fade-in duration-200">
          <div className="flex size-8 shrink-0 select-none items-center justify-center pt-0.5">
            <ThinkingLogo />
          </div>
          <div className="max-w-[85%] sm:max-w-[80%] rounded-2xl rounded-tl-xs border border-border/70 bg-card/80 px-4 py-3.5 shadow-xs">
            {(() => {
              const reasoningBlocks = blocks.filter((b) => b.kind === "reasoning");
              const hasTimelineReasoning = reasoningBlocks.length > 0;
              return !hasTimelineReasoning && reasoningText
                ? <ReasoningBlock text={reasoningText} live={runLive} />
                : null;
            })()}
            {statusText && blocks.length === 0 && !streamText ? (
              <p className="mb-2 text-[11px] text-muted-foreground">{statusText}</p>
            ) : null}
            {blocks.length > 0 ? (
              blocks.map((block, idx) => {
                return (
                  <div key={block.key} className="my-2 first:mt-0 last:mb-0">
                    {block.kind === "text" ? (
                      <LiveTextBlock
                        text={block.text}
                        live={runLive && idx === blocks.length - 1}
                      />
                    ) : block.kind === "reasoning" ? (
                      <ReasoningBlock text={block.text} live={runLive} active={!block.ended && idx === blocks.length - 1} durationMs={block.durationMs} />
                    ) : block.kind === "artifact" ? (
                      <CodeArtifact artifact={block.artifact} live={block.writing} />
                    ) : block.kind === "file" ? (
                      <WorkspaceFileChip path={block.path} />
                    ) : block.kind === "research" ? (
                      <ResearchCard research={block.research} status={block.status} activityLabel={block.activityLabel} />
                    ) : (
                      <ToolGroup
                        steps={block.steps ?? [block.step]}
                        runId={props.runId ?? undefined}
                        live={runLive}
                      />
                    )}
                  </div>
                );
              })
            ) : (
              <>
                {liveSteps.length > 0 && (
                  <div className="mb-2">
                    <ToolGroup steps={liveSteps} runId={props.runId ?? undefined} live />
                  </div>
                )}
                {streamText ? (
                  <LiveTextBlock text={streamText} live={runLive} />
                ) : null}
              </>
            )}
          </div>
        </div>
      )}

      {showThinking && (
        <div className="py-3" role="status" aria-live="polite">
          <ThinkingLogo />
          {statusText && (
            <p className="mt-1 text-center text-[11px] text-muted-foreground">{statusText}</p>
          )}
        </div>
      )}
    </>
  );
}

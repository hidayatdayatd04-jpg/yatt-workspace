import { extractAskBlocks, stripAskBlocks } from "./ask-card";
import { AskCard } from "./AskCard";
import { extractApprovalBlocks, stripApprovalBlocks } from "./approval-card";
import { ApprovalCard } from "./ApprovalCard";
import { extractSuggestions, stripSuggestions } from "./suggestion-card";
import { SuggestionChips } from "./SuggestionChips";
import { Markdown } from "./Markdown";

const CONFIDENCE_RE = /^\s*(?:\*\*)?tingkat kepercayaan(?:\*\*)?:\s*(tinggi|sedang|rendah)\b([^\n]*)/im;

function extractConfidence(text: string): { level: "Tinggi" | "Sedang" | "Rendah"; reason: string } | null {
  const m = CONFIDENCE_RE.exec(text);
  if (!m) return null;
  const raw = m[1]!.toLowerCase();
  const level = raw === "tinggi" ? ("Tinggi" as const) : raw === "rendah" ? ("Rendah" as const) : ("Sedang" as const);
  const reason = (m[2] ?? "").replace(/^[\s—–-]+/, "").trim().slice(0, 200);
  return { level, reason };
}

export function stripConfidence(text: string): string {
  return text
    .replace(CONFIDENCE_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ConfidenceBadge(props: { level: "Tinggi" | "Sedang" | "Rendah"; reason: string }) {
  const color =
    props.level === "Tinggi"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : props.level === "Sedang"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400";
  return (
    <p className={`mb-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${color}`}>
      Kepercayaan: {props.level}
      {props.reason && <span className="font-normal opacity-80">· {props.reason}</span>}
    </p>
  );
}

export function AssistantBody({
  text,
  onAnswerAsk,
  onSendToTerminal,
  activeConnectionId,
  conversationId,
  onSelectPrompt,
  suggestionsDisabled,
}: {
  text: string;
  onAnswerAsk?: (label: string) => void;
  onSendToTerminal?: (code: string) => void;
  activeConnectionId?: string | null;
  conversationId?: string | null;
  onSelectPrompt?: (prompt: string) => void;
  suggestionsDisabled?: boolean;
}) {
  const specs = onAnswerAsk ? extractAskBlocks(text) : null;
  const approvalSpecs = extractApprovalBlocks(text);
  const suggestions = onSelectPrompt ? extractSuggestions(text) : null;
  const confidence = extractConfidence(text);
  let body = text;
  if (specs) body = stripAskBlocks(body);
  if (approvalSpecs) body = stripApprovalBlocks(body);
  if (suggestions) body = stripSuggestions(body);
  body = stripConfidence(body);
  return (
    <>
      {confidence && <ConfidenceBadge level={confidence.level} reason={confidence.reason} />}
      {body && <Markdown text={body} onSendToTerminal={onSendToTerminal} />}
      {approvalSpecs &&
        approvalSpecs.map((spec, i) => (
          <ApprovalCard key={i} spec={spec} activeConnectionId={activeConnectionId} conversationId={conversationId} />
        ))}
      {specs && onAnswerAsk ? specs.map((spec, i) => <AskCard key={i} spec={spec} onAnswer={onAnswerAsk} />) : null}
      {suggestions && onSelectPrompt ? (
        <SuggestionChips suggestions={suggestions} onSelect={onSelectPrompt} disabled={suggestionsDisabled} />
      ) : null}
    </>
  );
}

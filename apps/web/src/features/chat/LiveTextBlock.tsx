import { useMemo } from "react";
import { stripAskBlocks } from "./ask-card";
import { stripApprovalBlocks } from "./approval-card";
import { stripSuggestions } from "./suggestion-card";
import { stripConfidence } from "./AssistantBody";
import { balanceFences, Markdown } from "./Markdown";

export function LiveTextBlock({
  text,
  live,
}: {
  text: string;
  live?: boolean;
}) {
  // Teks tiba sudah berpacing huruf per huruf dari antrean; cukup render.
  const clean = useMemo(
    () => stripConfidence(stripSuggestions(stripApprovalBlocks(stripAskBlocks(balanceFences(text))))),
    [text],
  );
  return (
    <div className="relative">
      {clean ? <Markdown text={clean} live={live} /> : null}
    </div>
  );
}

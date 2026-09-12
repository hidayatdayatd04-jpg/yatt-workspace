import { tokenizeHtml, type HtmlToken } from "./code-highlight";

const SCOPE_CLASS: Record<HtmlToken["scope"], string | null> = {
  tag: "text-sky-600 dark:text-sky-400",
  attr: "text-amber-600 dark:text-amber-300",
  string: "text-emerald-600 dark:text-emerald-400",
  comment: "text-muted-foreground italic",
  text: null,
};

export function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

export function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

export function HighlightedHtml({ code }: { code: string }) {
  return (
    <>
      {tokenizeHtml(code).map((tok, i) => {
        const cls = SCOPE_CLASS[tok.scope];
        return cls ? (
          <span key={i} className={cls}>
            {tok.text}
          </span>
        ) : (
          <span key={i}>{tok.text}</span>
        );
      })}
    </>
  );
}

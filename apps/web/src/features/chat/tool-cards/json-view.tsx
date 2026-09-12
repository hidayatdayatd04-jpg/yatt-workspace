import { useMemo, useState } from "react";
import { redactSecretsDeep } from "./secret-redact";

const TRUNCATE_CHARS = 10_000;
const PREVIEW_LINES = 150;

function pretty(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return JSON.stringify(redactSecretsDeep(parsed), null, 2);
  } catch {
    return raw;
  }
}

function tokenizeLine(line: string): Array<{ text: string; scope: "key" | "string" | "number" | "literal" | "text" }> {
  const out: Array<{ text: string; scope: "key" | "string" | "number" | "literal" | "text" }> = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let last = 0;
  for (const m of line.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: line.slice(last, at), scope: "text" });
    if (m[1] !== undefined) {
      out.push({ text: m[1], scope: m[2] !== undefined ? "key" : "string" });
    } else if (m[3] !== undefined) out.push({ text: m[3], scope: "literal" });
    else out.push({ text: m[4] ?? "", scope: "number" });
    last = at + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), scope: "text" });
  return out;
}

const SCOPE_CLASS: Record<string, string> = {
  key: "text-sky-500 dark:text-sky-400",
  string: "text-emerald-600 dark:text-emerald-400",
  number: "text-amber-600 dark:text-amber-400",
  literal: "text-violet-600 dark:text-violet-400",
  text: "",
};

/** Viewer JSON dengan highlight ringan tanpa dependensi; output panjang dipotong dulu. */
export function JsonView(props: { value: string; className?: string }) {
  const [showAll, setShowAll] = useState(false);
  const text = useMemo(() => pretty(props.value), [props.value]);
  const tooLong = text.length > TRUNCATE_CHARS;
  const lines = useMemo(() => {
    if (!tooLong || showAll) return text.split("\n");
    return text.split("\n").slice(0, PREVIEW_LINES);
  }, [text, tooLong, showAll]);
  return (
    <div className={`overflow-hidden rounded-xl border border-border/70 bg-muted/30 ${props.className ?? ""}`}>
      <div className="max-h-[420px] overflow-auto p-3 text-xs leading-relaxed">
        <pre className="whitespace-pre font-mono">
          {lines.map((line, i) => (
            <div key={i}>
              {tokenizeLine(line).map((token, j) => (
                <span key={j} className={SCOPE_CLASS[token.scope]}>{token.text}</span>
              ))}
            </div>
          ))}
        </pre>
        {tooLong && !showAll && (
          <p className="mt-2 font-sans text-[11px] text-muted-foreground">
            Output terlalu panjang — menampilkan {PREVIEW_LINES} baris pertama.
          </p>
        )}
      </div>
      {tooLong && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full border-t border-border/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          {showAll ? "Tampilkan ringkas" : "Tampilkan semua"}
        </button>
      )}
    </div>
  );
}

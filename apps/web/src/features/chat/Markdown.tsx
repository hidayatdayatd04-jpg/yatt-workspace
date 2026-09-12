import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkCleanResponse } from "./clean-response";
import { CodeBlock } from "./OutputBlocks";
import { detectLanguage, extractFenceLanguage, extractText, sanitizeTerminalText } from "./markdown-utils";

export { balanceFences } from "./markdown-utils";

export function Markdown({
  text,
  live,
}: {
  text: string;
  live?: boolean;
}) {
  const safe = sanitizeTerminalText(text);
  // Identitas renderer stabil: canvas dan spinner tidak remount setiap delta.
  const components = useMemo<Components>(() => ({
          a: ({ href, children }) => {
            const url = href && /^https?:\/\//i.test(href) ? href : undefined;
            if (!url) return <>{children}</>;
            return (
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-indigo-600 hover:text-indigo-500 underline underline-offset-2 dark:text-indigo-400 font-medium"
              >
                {children}
              </a>
            );
          },
          pre: ({ children }) => {
            const codeText = extractText(children);
            const fence = extractFenceLanguage(children);
            return (
              <CodeBlock
                language={fence || detectLanguage(codeText)}
                code={codeText}
                live={live}
              />
            );
          },
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className ?? "");
            if (isBlock) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground font-semibold"
                {...props}
              >
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full text-left text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border bg-muted/50 p-2.5 font-semibold text-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/50 p-2.5 text-muted-foreground last:border-0">
              {children}
            </td>
          ),
  }), [live]);
  return (
    <div className="chat-markdown prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-pre:rounded-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCleanResponse]}
        components={components}
      >
        {safe}
      </ReactMarkdown>
    </div>
  );
}

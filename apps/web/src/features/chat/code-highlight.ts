export interface HtmlToken {
  text: string;
  scope: "tag" | "attr" | "string" | "comment" | "text";
}

/**
 * Tokenizer ringan untuk highlight HTML/SVG di kanvas kode.
 * Fungsi murni tanpa dependensi agar kanvas tetap cepat saat streaming.
 */
export function tokenizeHtml(code: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  const outer = /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z!][^>]*>?)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = outer.exec(code)) !== null) {
    if (m.index > last) tokens.push({ text: code.slice(last, m.index), scope: "text" });
    if (m[1]) tokens.push({ text: m[0], scope: "comment" });
    else pushTag(tokens, m[0]);
    last = m.index + m[0].length;
  }
  if (last < code.length) tokens.push({ text: code.slice(last), scope: "text" });
  return tokens;
}

function pushTag(tokens: HtmlToken[], tag: string): void {
  let i = 0;
  const eat = (re: RegExp): string => {
    re.lastIndex = i;
    const mm = re.exec(tag);
    if (mm && mm.index === i) {
      i += mm[0].length;
      return mm[0];
    }
    return "";
  };
  const open = eat(/<\/?[a-zA-Z!][\w-]*/y);
  if (open) tokens.push({ text: open, scope: "tag" });
  for (;;) {
    const sp = eat(/\s+/y);
    if (sp) tokens.push({ text: sp, scope: "text" });
    if (i >= tag.length) break;
    const close = eat(/\/?>/y);
    if (close) {
      tokens.push({ text: close, scope: "tag" });
      break;
    }
    const attr = eat(/[\w-]+/y);
    if (attr) {
      tokens.push({ text: attr, scope: "attr" });
      continue;
    }
    if (eat(/=/y)) {
      tokens.push({ text: "=", scope: "text" });
      continue;
    }
    const str = eat(/"[^"]*"|'[^']*'|[^\s>]+/y);
    if (str) {
      const quoted = str[0] === '"' || str[0] === "'";
      tokens.push({ text: str, scope: quoted ? "string" : "text" });
      continue;
    }
    tokens.push({ text: tag[i]!, scope: "text" });
    i += 1;
  }
}

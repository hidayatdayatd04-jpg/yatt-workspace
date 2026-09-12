/** Util markdown murni — dipakai UI dan pengujian tanpa komponen React. */

/** Strip ANSI/OSC escape sequences from model output before render. */
export function sanitizeTerminalText(text: string): string {
  return text
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B\[[0-9;?]*[A-Za-z]/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

export function detectLanguage(code: string): string {
  const t = code.trim().toLowerCase();
  if (t.startsWith("/")) return "RouterOS";
  if (t.includes("{") && t.includes(":")) return "JSON";
  if (t.includes("get-") || t.includes("write-host")) return "PowerShell";
  if (t.includes("#!/bin/bash") || t.startsWith("sudo ")) return "Bash";
  return "Code";
}

export function extractText(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in (node as Record<string, unknown>)) {
    const props = (node as { props?: { children?: unknown } }).props;
    return extractText(props?.children);
  }
  return "";
}

/** Tutup pagar kode yang belum selesai agar Markdown tidak berkedip saat stream. */
export function balanceFences(text: string): string {
  const count = (text.match(/```/g) ?? []).length;
  return count % 2 === 1 ? `${text}\n\`\`\`` : text;
}

/** Ambil bahasa dari pagar kode (```html) untuk label kanvas kode. */
export function extractFenceLanguage(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = extractFenceLanguage(child);
      if (found) return found;
    }
    return "";
  }
  if (typeof node === "object" && "props" in (node as Record<string, unknown>)) {
    const props = (node as { props?: { className?: unknown; children?: unknown } }).props;
    const cls = typeof props?.className === "string" ? props.className : "";
    const m = /language-([\w+-]+)/.exec(cls);
    if (m?.[1]) return m[1];
    return extractFenceLanguage(props?.children);
  }
  return "";
}

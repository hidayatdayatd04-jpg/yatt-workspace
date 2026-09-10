import { z } from "zod";
import { ToolResultError } from "../errors";
import { defineTool, objectSchema, stringField } from "../types";
import { validateEgressUrl } from "../../lib/url-policy";

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;
const TEXTUAL = /^(text\/|application\/(json|xml|javascript|x-yaml|xml|ld\+json)|[^;]*(yaml|csv|markdown))/i;

/**
 * web:fetch_url — baca isi URL tertentu dengan proteksi egress: IP internal
 * diblokir (resolve-then-validate), redirect manual tiap-hop divalidasi ulang,
 * ukuran respons dibatasi streaming, timeout ketat.
 */
export function createWebFetchTool() {
  return defineTool({ name: "web:fetch_url", connector: "workspace", tags: ["web", "fetch", "read", "http"],
    description: "Baca isi satu URL (dokumen, halaman, API publik) menjadi teks. Untuk MENCARI sumber gunakan web:search dulu. Response dibatasi ukuran dan durasi; IP internal diblokir.",
    schema: z.object({
      url: z.string().min(4).max(2000),
      method: z.enum(["GET", "HEAD"]).default("GET"),
      maxBytes: z.number().int().min(1000).max(MAX_BYTES).default(200_000),
    }).strict(),
    parameters: objectSchema({ url: stringField, method: { type: "string", enum: ["GET", "HEAD"] }, maxBytes: { type: "integer", minimum: 1000, maximum: MAX_BYTES } }, ["url"]),
    execute: async (args) => {
      let target = args.url;
      let finalUrl = args.url;
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const validated = await validateEgressUrl(target, { maxBytes: args.maxBytes });
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        let response: Response;
        try {
          response = await fetch(validated.url, {
            method: args.method,
            redirect: "manual",
            signal: controller.signal,
            headers: { "User-Agent": "YATT-Agent/0.1 (+local tool)", Accept: "text/html,application/json,text/plain,*/*" },
          });
        } catch (err) {
          clearTimeout(timer);
          const aborted = err instanceof Error && err.name === "AbortError";
          throw new ToolResultError(aborted ? "TOOL_TIMEOUT" : "NETWORK_ERROR", aborted ? `Fetch ${target} melebihi ${TIMEOUT_MS / 1000}s.` : `Fetch ${target} gagal: ${err instanceof Error ? err.message : String(err)}`);
        }
        clearTimeout(timer);
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get("location");
          if (!location) throw new ToolResultError("HTTP_ERROR", `Redirect ${response.status} tanpa header Location.`);
          if (hop === MAX_REDIRECTS) throw new ToolResultError("HTTP_ERROR", `Melebihi ${MAX_REDIRECTS} redirect (berakhir di ${location}).`);
          target = new URL(location, target).toString();
          finalUrl = target;
          continue;
        }
        if (!response.ok) throw new ToolResultError("HTTP_ERROR", `HTTP ${response.status} ${response.statusText} dari ${target}`, { retryable: response.status === 429 || response.status >= 500 });
        const contentType = response.headers.get("content-type") ?? "";
        const sizeLimit = Math.min(args.maxBytes, MAX_BYTES);
        const text = await readBounded(response, contentType, sizeLimit);
        return { url: args.url, finalUrl, status: response.status, contentType: contentType || "unknown", bytes: text.length, truncated: text.length >= sizeLimit, content: text };
      }
      throw new ToolResultError("HTTP_ERROR", "Redirect chain terlalu panjang.");
    },
  });
}

/** Baca body dengan batas ukuran; hanya konten tekstual yang dikembalikan utuh. */
async function readBounded(response: Response, contentType: string, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let received = 0;
  let out = "";
  const chunks: Buffer[] = [];
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    chunks.push(Buffer.from(value));
  }
  try {
    await reader.cancel();
  } catch {
    /* stream selesai/tutup */
  }
  const body = Buffer.concat(chunks);
  const bounded = body.subarray(0, maxBytes);
  if (contentType && !TEXTUAL.test(contentType)) {
    // non-teks: jangan sertakan dump biner, cukup metadata + cuplikan
    const printable = bounded.subarray(0, 500).toString("utf8").replace(/[^\x20-\x7E\n\r\t]/g, "");
    return `[Konten non-teks (${contentType}, ${body.length} bytes) — cuplikan: ${printable}]`;
  }
  out = decoder.decode(bounded);
  return out;
}

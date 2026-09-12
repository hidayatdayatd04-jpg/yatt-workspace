import { looksTextualFile, isTextBytes } from "./text";

export type SniffedKind = "image" | "pdf" | "text" | "doc" | "archive" | "unsupported";
export interface DetectResult { ok: boolean; kind: SniffedKind; mimeType?: string; reason?: string }
const normalizeMime = (mime: string) => mime.split(";")[0]!.trim().toLowerCase();
const DOC_EXTENSIONS = new Set(["docx", "xlsx", "xls", "pptx", "odt", "ods", "odp"]);

/** MIME parameters and browser aliases never override the actual file signature. */
export function detectContentKind(input: { mimeType: string; originalName: string; head: Buffer }): DetectResult {
  const name = input.originalName.toLowerCase();
  const ext = name.split(".").pop() ?? "";
  const head = input.head;
  const mime = normalizeMime(input.mimeType);
  const image = (mimeType: string): DetectResult => ({ ok: true, kind: "image", mimeType });
  if (head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return image("image/png");
  if (head.length >= 3 && head[0] === 255 && head[1] === 216 && head[2] === 255) return image("image/jpeg");
  if (/^GIF8[79]a$/.test(head.subarray(0, 6).toString("ascii"))) return image("image/gif");
  if (head.subarray(0, 4).toString() === "RIFF" && head.subarray(8, 12).toString() === "WEBP") return image("image/webp");
  if (head.subarray(0, 5).toString() === "%PDF-") return { ok: true, kind: "pdf", mimeType: "application/pdf" };
  const zip = head.length >= 4 && head[0] === 80 && head[1] === 75 && [3, 5, 7].includes(head[2]!);
  const ole = head.subarray(0, 4).equals(Buffer.from([208, 207, 17, 224]));
  if ((zip || ole) && DOC_EXTENSIONS.has(ext)) return { ok: true, kind: "doc" };
  if (zip) return { ok: true, kind: "archive", mimeType: "application/zip" };
  const textMime = mime.startsWith("text/") || /(?:json|xml|yaml|javascript|typescript|sql)/.test(mime);
  if (isTextBytes(head) && (looksTextualFile(name) || textMime || !mime || mime === "application/octet-stream" || mime === "application/rtf")) {
    return { ok: true, kind: "text", mimeType: textMime ? mime : "text/plain" };
  }
  return { ok: false, kind: "unsupported", reason: `File .${ext} tersimpan, tetapi format ini belum memiliki pembaca. Jangan menyimpulkan isi dari nama file.` };
}

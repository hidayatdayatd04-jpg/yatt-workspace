import type { Buffer } from "node:buffer";
import { decodeText } from "./text";
import { extractPdfText } from "./pdf";
import { extractOfficeText } from "./office";
import { extractArchiveText } from "./zip";

/**
 * Ekstrak teks dari lampiran apa pun yang dikenali (PDF, Word, Excel,
 * PowerPoint, OpenDocument, ZIP/folder, teks/kode). Null bila format tidak
 * bisa dibaca — pemanggil tetap merekam blok lampiran tanpa teks.
 */
export async function extractAttachmentText(input: {
  name: string;
  kind: "pdf" | "doc" | "archive" | "text";
  bytes: Buffer;
}): Promise<string | null> {
  const { kind, bytes, name } = input;
  if (kind === "text") {
    const text = decodeText(bytes);
    return text.trim() ? text : null;
  }
  if (kind === "pdf") return extractPdfText(bytes);
  if (kind === "doc") return extractOfficeText(name, bytes);
  if (kind === "archive") return extractArchiveText(name, bytes, 0);
  return null;
}

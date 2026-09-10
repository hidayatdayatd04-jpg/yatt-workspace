import { renderPdfPage } from "./pdf-pages";
import { createHash } from "node:crypto";
import { detectContentKind } from "./detect";
import { extractAttachmentText } from "./index";
import { readZipEntries } from "./zip-entries";

export type DescribeImage = (input: { bytes: Buffer; name: string; mime: string }) => Promise<string>;
/** Unified paged reader: never decode binary files as plain text. */
export async function readFileContent(input: {
  name: string; bytes: Buffer; mime?: string; offset?: number; page?: number; entryPath?: string; describeImage?: DescribeImage;
}) {
  let { bytes, name } = input;
  if (bytes.length > 25_000_000) throw new Error("Batas pembacaan file 25 MB terlampaui.");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  let detected = detectContentKind({ originalName: name, mimeType: input.mime ?? "", head: bytes.subarray(0, 512) });
  if (input.entryPath) {
    if (detected.kind !== "archive") throw new Error("entryPath hanya berlaku untuk arsip ZIP.");
    bytes = Buffer.from(readZipEntries(bytes, input.entryPath).files[input.entryPath]!);
    name = input.entryPath;
    detected = detectContentKind({ originalName: name, mimeType: "", head: bytes.subarray(0, 512) });
  }
  const offset = input.offset ?? 0;
  if (detected.kind === "archive") {
    const { entries } = readZipEntries(bytes, "");
    return { name, kind: detected.kind, entries: entries.slice(offset, offset + 100),
      nextOffset: offset + 100 < entries.length ? offset + 100 : null, sha256,
      instruction: "Gunakan entryPath (nama lengkap entri) untuk membaca isinya; offset untuk daftar selanjutnya." };
  }
  if (detected.kind === "pdf" && input.describeImage) {
    const rendered = await renderPdfPage(bytes, input.page ?? 1);
    const content = await input.describeImage({ name: `${name} (halaman ${input.page ?? 1})`, bytes: rendered.bytes, mime: "image/png" });
    return { name, kind: "pdf", page: input.page ?? 1, totalPages: rendered.totalPages, nextPage: rendered.nextPage,
      content, sha256, nextOffset: null };
  }
  let content: string | null;
  if (detected.kind === "image") {
    content = input.describeImage ? await input.describeImage({ bytes, name, mime: detected.mimeType! }) :
      "Gambar tersedia. Gunakan pembaca vision untuk memahami isinya; nama file bukan bukti isi gambar.";
  } else if (detected.kind === "unsupported") {
    content = detected.reason ?? "Format belum memiliki pembaca. Isi belum dianalisis.";
  } else {
    content = await extractAttachmentText({ name, bytes, kind: detected.kind });
    if (content === null) content = bytes.length === 0 ? "[File kosong]" : "[Ekstraksi gagal atau dokumen tidak memiliki teks. PDF hasil pindai membutuhkan OCR/vision. Jangan menebak isi dari nama file.]";
  }
  return { name, kind: detected.kind, content: content.slice(offset, offset + 6000),
    nextOffset: offset + 6000 < content.length ? offset + 6000 : null, totalChars: content.length, sha256 };
}

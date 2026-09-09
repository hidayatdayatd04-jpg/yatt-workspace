import { looksTextualFile } from "./text";

/** Jenis konten lampiran yang dikenali server. */
export type SniffedKind = "image" | "pdf" | "text" | "doc" | "archive" | "unsupported";
export interface DetectResult {
  ok: boolean;
  kind: SniffedKind;
  reason?: string;
}

const DOC_EXTENSIONS = new Set(["docx", "xlsx", "xls", "pptx", "odt", "ods", "odp"]);
const ARCHIVE_EXTENSIONS = new Set(["zip"]);
const ACCEPTED_TEXT_MIME =
  (m: string) => m === "" || m.startsWith("text/") || /^(application\/(json|xml|javascript|typescript|x-yaml|x-sh|x-httpd-php|sql|octet-stream|pdf))$/.test(m) || m.includes("+xml");

/** Magic-byte sniffing: klaim ekstensi/MIME tidak dipercaya. */
export function detectContentKind(input: { mimeType: string; originalName: string; head: Buffer }): DetectResult {
  const name = input.originalName.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  const head = input.head;

  if (head.length >= 4 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) {
    return input.mimeType === "image/png" ? { ok: true, kind: "image" } : { ok: false, kind: "unsupported", reason: "MIME tidak cocok dengan isi PNG." };
  }
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return input.mimeType === "image/jpeg" ? { ok: true, kind: "image" } : { ok: false, kind: "unsupported", reason: "MIME tidak cocok dengan isi JPEG." };
  }
  if (head.length >= 12 && head.slice(0, 4).toString("ascii") === "RIFF" && head.slice(8, 12).toString("ascii") === "WEBP") {
    return input.mimeType === "image/webp" ? { ok: true, kind: "image" } : { ok: false, kind: "unsupported", reason: "MIME tidak cocok dengan isi WebP." };
  }
  if (head.length >= 5 && head.slice(0, 5).toString("ascii") === "%PDF-") {
    return { ok: true, kind: "pdf" };
  }
  const zipMagic = head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07);
  const oleMagic = head.length >= 4 && head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;
  if (zipMagic || oleMagic) {
    if (DOC_EXTENSIONS.has(ext)) return { ok: true, kind: "doc" };
    if (oleMagic) {
      return { ok: false, kind: "unsupported", reason: `Dokumen .${ext} (format lama) tidak didukung; simpan ulang sebagai .docx/.xlsx/.pptx.` };
    }
    if (ARCHIVE_EXTENSIONS.has(ext)) return { ok: true, kind: "archive" };
    return { ok: false, kind: "unsupported", reason: `Isi ZIP dengan ekstensi .${ext || "?"} tidak dikenal.` };
  }
  if (looksTextualFile(name)) {
    const sample = head.subarray(0, 512);
    let textual = sample.length === 0;
    for (const b of sample) {
      if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || b >= 128) {
        textual = true;
      } else {
        textual = false;
        break;
      }
    }
    if (!textual) return { ok: false, kind: "unsupported", reason: "File teks berisi byte biner." };
    if (!ACCEPTED_TEXT_MIME(input.mimeType)) {
      return { ok: false, kind: "unsupported", reason: `MIME ${input.mimeType} tidak cocok untuk file teks .${ext}.` };
    }
    return { ok: true, kind: "text" };
  }
  return {
    ok: false,
    kind: "unsupported",
    reason: `Tipe file .${ext || "?"} (${input.mimeType}) tidak didukung. Gunakan gambar, PDF, dokumen (docx/xlsx/pptx/odt), ZIP, atau file teks/kode (txt, md, tsx, html, php, py, json, dll.).`,
  };
}

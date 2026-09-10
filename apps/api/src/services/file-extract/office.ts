import { readZipEntries } from "./zip-entries";
import { unzipSync, strFromU8 } from "fflate";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

const MAX_OFFICE_CHARS = 60_000;

function clip(text: string): string {
  return text.length > MAX_OFFICE_CHARS ? `${text.slice(0, MAX_OFFICE_CHARS)}\n[... isi dokumen terpotong]` : text;
}

function extOf(name: string): string {
  const lower = name.toLowerCase();
  return lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
}

/** docx → teks mentah (mammoth; heading/tabel direduksi jadi teks). */
async function extractDocx(bytes: Buffer): Promise<string | null> {
  try {
    const { value } = await mammoth.extractRawText({ buffer: bytes });
    return value ?? null;
  } catch {
    return null;
  }
}

/** xls/xlsx → CSV per sheet (SheetJS; angka, tanggal, formula hasil di-resolve). */
function extractSpreadsheet(bytes: Buffer): string | null {
  try {
    const wb = XLSX.read(bytes, { type: "buffer" });
    const parts: string[] = [];
    for (const name of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]!, { blankrows: false }).trim();
      if (csv) parts.push(`# Sheet: ${name}\n${csv}`);
    }
    return parts.length > 0 ? parts.join("\n\n") : null;
  } catch {
    return null;
  }
}

/** Ambil teks dari XML Office/OpenDocument: buang tag, pertahankan paragraf. */
function xmlToText(xml: string): string {
  return xml
    .replace(/<a:br\s*\/>/g, "\n")
    .replace(/<\/a:p>/g, "\n")
    .replace(/<\/text:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** pptx → teks per slide (zip XML, urut nomor slide). */
function extractPptx(bytes: Buffer): string | null {
  try {
    const files = unzipSync(new Uint8Array(bytes), { filter: (f) => /^ppt\/slides\/slide\d+\.xml$/.test(f.name) });
    const names = Object.keys(files).sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
    const parts = names
      .map((n, i) => `## Slide ${i + 1}\n${xmlToText(strFromU8(files[n]!))}`)
      .filter((p) => p.replace(/^## Slide \d+\n?/, "").length > 0);
    return parts.length > 0 ? parts.join("\n\n") : null;
  } catch {
    return null;
  }
}

/** ODT/ODS/ODP → teks dari content.xml. */
function extractOpenDocument(bytes: Buffer): string | null {
  try {
    const files = unzipSync(new Uint8Array(bytes), { filter: (f) => f.name === "content.xml" });
    const content = files["content.xml"];
    if (!content) return null;
    return xmlToText(strFromU8(content));
  } catch {
    return null;
  }
}

/** Dispatcher dokumen Office/OpenDocument berdasarkan ekstensi. Null = gagal. */
export async function extractOfficeText(name: string, bytes: Buffer): Promise<string | null> {
  const ext = extOf(name);
  if (ext !== "xls") readZipEntries(bytes, "");
  let text: string | null = null;
  if (ext === "docx") text = await extractDocx(bytes);
  else if (ext === "xlsx" || ext === "xls") text = extractSpreadsheet(bytes);
  else if (ext === "pptx") text = extractPptx(bytes);
  else if (ext === "odt" || ext === "ods" || ext === "odp") text = extractOpenDocument(bytes);
  return text && text.trim() ? clip(text) : null;
}

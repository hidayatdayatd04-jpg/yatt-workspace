/** Ekstraksi teks PDF via unpdf (pdfjs serverless build; aman di Bun). */
const MAX_PDF_CHARS = 40_000;

export async function extractPdfText(bytes: Buffer): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    const merged = (Array.isArray(text) ? text.join("\n\n") : text).trim();
    if (!merged) return null;
    return merged.length > MAX_PDF_CHARS ? `${merged.slice(0, MAX_PDF_CHARS)}\n[... teks PDF terpotong]` : merged;
  } catch {
    return null;
  }
}

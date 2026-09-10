/** Text extraction with an explicit context limit; page reader handles visual PDFs. */
const MAX_PDF_CHARS = 40_000;
export async function extractPdfText(bytes: Buffer): Promise<string | null> {
  const { getDocumentProxy } = await import("unpdf");
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes));
    const parts: string[] = [];
    let length = 0;
    for (let number = 1; number <= pdf.numPages && number <= 100; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const text = content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("");
      parts.push(`Halaman ${number}:\n${text}`);
      length += text.trim().length;
      if (length >= MAX_PDF_CHARS || number === 100 && pdf.numPages > 100) {
        parts.push("[Cuplikan PDF dibatasi. Gunakan general:read_attachment dengan page untuk halaman lainnya.]");
        break;
      }
    }
    if (!length) return null;
    const merged = parts.join("\n\n");
    return merged.length > MAX_PDF_CHARS ? `${merged.slice(0, MAX_PDF_CHARS)}\n[Cuplikan terpotong; baca halaman selanjutnya dengan tool.]` : merged;
  } catch { return null; }
  finally { await pdf?.loadingTask.destroy(); }
}

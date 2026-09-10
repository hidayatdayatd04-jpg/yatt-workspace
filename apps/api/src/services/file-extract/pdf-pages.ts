import { getDocumentProxy, renderPageAsImage } from "unpdf";

/** Render one page only, with a bounded pixel budget and deterministic cleanup. */
export async function renderPdfPage(bytes: Buffer, pageNumber = 1) {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  try {
    if (pageNumber < 1 || pageNumber > pdf.numPages) throw new Error(`Halaman PDF harus antara 1 dan ${pdf.numPages}.`);
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 2000 / Math.max(viewport.width, viewport.height));
    const rendered = await renderPageAsImage(pdf, pageNumber, { scale, canvasImport: () => import("@napi-rs/canvas") });
    if (typeof rendered === "string") throw new Error("Hasil render PDF tidak valid.");
    return { bytes: Buffer.from(rendered), totalPages: pdf.numPages, nextPage: pageNumber < pdf.numPages ? pageNumber + 1 : null };
  } finally { await pdf.loadingTask.destroy(); }
}

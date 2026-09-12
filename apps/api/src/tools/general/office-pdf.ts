import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { defineTool, objectSchema, stringField } from "../types";
import { officeTarget, readForEdit, writeEdited } from "./office-shared";

const pathSchema = z.string().min(1).max(1000);
const pageTextSchema = z.array(z.object({ text: z.string().max(20_000).default(""), bullets: z.array(z.string().max(2000)).max(50).optional(), size: z.number().min(6).max(72).default(11) })).max(200);

/** Escape PDF string literal (parantes + backslash) untuk drawText. */
function pdfEscape(s: string) {
  return s.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

/** Buat + edit PDF lokal via pdf-lib: teks, merge, extract halaman, rotate, form, flatten. */
export function createOfficePdfTools(baseDir: string) {
  return [
    defineTool({ name: "office:create_pdf", connector: "workspace", permission: "write", description: "Buat PDF baru di workspace: satu halaman per item — teks dan/atau bullet list (font standar, teks Indonesia aman). Teks panjang dibungkus otomatis (wrap 80 kolom).", schema: z.object({ path: pathSchema, pages: pageTextSchema.min(1) }).strict(), parameters: objectSchema({ path: stringField, pages: { type: "array" } }, ["path", "pages"]),
      execute: async (args, run) => {
        const pdf = await PDFDocument.create();
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        for (const page of args.pages) {
          const p = pdf.addPage([595.28, 841.89]); // A4
          const lines: string[] = [];
          if (page.text) for (const raw of page.text.split("\n")) { for (const chunk of wrap80(raw)) lines.push(chunk); }
          if (page.bullets) for (const b of page.bullets) { for (const [i, chunk] of wrap80(b).entries()) lines.push(i === 0 ? `• ${chunk}` : `  ${chunk}`); }
          let y = 780;
          for (const line of lines) { p.drawText(pdfEscape(line), { x: 50, y, size: page.size, font }); y -= page.size * 1.6; if (y < 40) break; }
        }
        const bytes = Buffer.from(await pdf.save());
        const file = await officeTarget(baseDir, run.userId, args.path);
        return writeEdited(file, args.path, bytes);
      } }),
    defineTool({ name: "office:edit_pdf", connector: "workspace", permission: "write", description: "Edit PDF existing di workspace: merge file lain di akhir, extract halaman (1-based, index negatif dari belakang) ke file baru, rotate halaman, isi form field AcroForm (nama → nilai), atau flatten (form jadi permanen). expectedHash opsional untuk proteksi tumpang-tindih. Bukan replace teks bebas — itu di luar kemampuan.", schema: z.object({ path: pathSchema, expectedHash: z.string().regex(/^[a-f0-9]{64}$/).optional(), mergePaths: z.array(pathSchema).max(10).default([]), extractPages: z.object({ outputPath: pathSchema, pages: z.array(z.number().int().refine((n) => n !== 0, "Halaman tidak boleh 0 — pakai 1-based atau negatif dari belakang")).min(1).max(200) }).optional(), rotate: z.object({ pages: z.array(z.number().int().refine((n) => n !== 0, "Halaman tidak boleh 0")).max(200), degrees: z.union([z.literal(90), z.literal(180), z.literal(270)]) }).optional(), fillForm: z.array(z.object({ name: z.string().min(1).max(200), value: z.string().max(2000) })).max(50).default([]), flatten: z.boolean().default(false) }).strict(), parameters: objectSchema({ path: stringField, expectedHash: stringField, mergePaths: { type: "array" }, extractPages: { type: "object" }, rotate: { type: "object" }, fillForm: { type: "array" }, flatten: { type: "boolean" } }, ["path"]),
      execute: async (args, run) => {
        const file = await officeTarget(baseDir, run.userId, args.path);
        const { bytes } = await readForEdit(file, args.expectedHash);
        const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
        const merged = 0;
        for (const mergePath of args.mergePaths) {
          const other = await officeTarget(baseDir, run.userId, mergePath);
          const otherPdf = await PDFDocument.load(await readFile(other), { ignoreEncryption: true });
          const copied = await pdf.copyPages(otherPdf, otherPdf.getPageIndices());
          for (const page of copied) pdf.addPage(page);
        }
        let extract: Awaited<ReturnType<typeof writeEdited>> | undefined;
        if (args.extractPages) {
          const indices = args.extractPages.pages.map((n) => n > 0 ? n - 1 : pdf.getPageCount() + n).sort((a, b) => a - b);
          for (const i of indices) if (i < 0 || i >= pdf.getPageCount()) throw new Error(`Halaman ${args.extractPages.pages.join(", ")} di luar rentang (total ${pdf.getPageCount()}).`);
          const out = await PDFDocument.create();
          const copied = await out.copyPages(pdf, indices);
          for (const page of copied) out.addPage(page);
          const outFile = await officeTarget(baseDir, run.userId, args.extractPages.outputPath);
          extract = await writeEdited(outFile, args.extractPages.outputPath, Buffer.from(await out.save()));
        }
        if (args.rotate) {
          const indices = args.rotate.pages.map((n) => n > 0 ? n - 1 : pdf.getPageCount() + n);
          for (const i of indices) if (i < 0 || i >= pdf.getPageCount()) throw new Error(`Halaman ${args.rotate.pages.join(", ")} di luar rentang (total ${pdf.getPageCount()}).`);
          for (const i of indices) {
            const page = pdf.getPages()[i]!;
            page.setRotation(degrees((page.getRotation().angle + args.rotate.degrees) % 360));
          }
        }
        const form = pdf.getForm();
        const filled: string[] = [];
        for (const { name, value } of args.fillForm) {
          const field = form.getFields().find((f) => f.getName() === name);
          if (!field) throw new Error(`Field form "${name}" tidak ditemukan. Field tersedia: ${form.getFields().map((f) => f.getName()).slice(0, 30).join(", ")}.`);
          if ("setText" in field && typeof field.setText === "function") { form.getTextField(name).setText(value); filled.push(name); }
          else throw new Error(`Field "${name}" bukan text field.`);
        }
        if (args.flatten) form.flatten();
        const saved = Buffer.from(await pdf.save());
        const result = { ...(await writeEdited(file, args.path, saved)), mergedCount: merged, filledFields: filled, extract };
        return result;
      } }),
  ];
}

/** Wrap teks ke ~80 kolom (estimasi aman Helvetica 11pt pada A4). */
function wrap80(text: string): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) { out.push(""); continue; }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if ((line + " " + word).trim().length > 80) { out.push(line.trim()); line = word; }
      else line = `${line} ${word}`.trim();
    }
    if (line) out.push(line.trim());
  }
  return out;
}

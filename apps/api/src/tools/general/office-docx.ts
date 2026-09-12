import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "docx";
import { z } from "zod";
import { defineTool, objectSchema, stringField } from "../types";
import { officeTarget, readForEdit, writeEdited } from "./office-shared";

const pathSchema = z.string().min(1).max(1000);
const paraSchema = z.object({ text: z.string().max(20_000), style: z.enum(["title", "heading1", "heading2", "heading3", "bullet", "paragraph"]).default("paragraph") });

function paragraphsOf(items: z.infer<typeof paraSchema>[]) {
  const heading = { title: HeadingLevel.TITLE, heading1: HeadingLevel.HEADING_1, heading2: HeadingLevel.HEADING_2, heading3: HeadingLevel.HEADING_3 } as const;
  return items.map((p) => {
    if (p.style === "bullet") return new Paragraph({ text: p.text, bullet: { level: 0 } });
    if (p.style === "title" || p.style === "heading1" || p.style === "heading2" || p.style === "heading3") {
      return new Paragraph({ children: [new TextRun({ text: p.text, bold: true })], heading: heading[p.style] });
    }
    return new Paragraph({ text: p.text });
  });
}

/** Escape entitas XML dasar agar teks pengguna tidak merusak document.xml. */
function xmlEscape(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Buat + edit dokumen Word (.docx): create baru via lib docx, edit existing via fflate. */
export function createOfficeDocxTools(baseDir: string) {
  return [
    defineTool({ name: "office:create_docx", connector: "workspace", permission: "write", description: "Buat dokumen Word (.docx) baru: paragraf (title/heading1-3/bullet/teks biasa) dan tabel sederhana. Menimpa bila path sudah ada; untuk file existing gunakan office:edit_docx.", schema: z.object({ path: pathSchema, title: z.string().max(300).optional(), paragraphs: z.array(paraSchema).max(300).default([]), table: z.object({ rows: z.array(z.array(z.string().max(5000))).min(1).max(100) }).optional() }).strict(), parameters: objectSchema({ path: stringField, title: stringField, paragraphs: { type: "array" }, table: { type: "object" } }, ["path"]),
      execute: async (args, run) => {
        const doc = new Document({
          sections: [{
            children: [
              ...(args.title ? [new Paragraph({ children: [new TextRun({ text: args.title, bold: true })], heading: HeadingLevel.TITLE })] : []),
              ...paragraphsOf(args.paragraphs),
              ...(args.table ? [new Table({ rows: args.table.rows.map((cells) => new TableRow({ children: cells.map((cell) => new TableCell({ children: [new Paragraph({ text: cell })] })) })) })] : []),
            ],
          }],
        });
        const bytes = Buffer.from(await Packer.toBuffer(doc));
        const file = await officeTarget(baseDir, run.userId, args.path);
        return writeEdited(file, args.path, bytes);
      } }),
    defineTool({ name: "office:edit_docx", connector: "workspace", permission: "write", description: "Edit dokumen Word (.docx) existing: find-and-replace + tambah paragraf di akhir. BATAS JUJUR: penggantian hanya berlaku pada frasa dalam satu run XML — frasa terpotong antar-run (mis. akibat format beda) tidak cocok dan dilaporkan di hasil. expectedHash (sha256 dari read_file) opsional.", schema: z.object({ path: pathSchema, expectedHash: z.string().regex(/^[a-f0-9]{64}$/).optional(), findReplace: z.array(z.object({ find: z.string().min(1).max(2000), replace: z.string().max(2000) })).max(50).default([]), appendParagraphs: z.array(z.string().max(20_000)).max(100).default([]) }).strict(), parameters: objectSchema({ path: stringField, expectedHash: stringField, findReplace: { type: "array" }, appendParagraphs: { type: "array" } }, ["path"]),
      execute: async (args, run) => {
        const file = await officeTarget(baseDir, run.userId, args.path);
        const { bytes } = await readForEdit(file, args.expectedHash);
        const entries = unzipSync(new Uint8Array(bytes));
        const docEntry = entries["word/document.xml"];
        if (!docEntry) throw new Error("File .docx tidak valid — word/document.xml tidak ditemukan.");
        let xml = strFromU8(docEntry);
        const report = { replaced: [] as string[], notFound: [] as string[], appended: args.appendParagraphs.length };
        for (const { find, replace } of args.findReplace) {
          if (xml.includes(xmlEscape(find))) {
            xml = xml.split(xmlEscape(find)).join(xmlEscape(replace));
            report.replaced.push(find);
          } else {
            report.notFound.push(find);
          }
        }
        if (args.appendParagraphs.length > 0) {
          const insertion = args.appendParagraphs.map((text) => `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`).join("");
          const bodyClose = xml.lastIndexOf("</w:body>");
          if (bodyClose === -1) throw new Error("Struktur document.xml tidak dikenali (tanpa w:body).");
          xml = xml.slice(0, bodyClose) + insertion + xml.slice(bodyClose);
        }
        const out = zipSync({ ...Object.fromEntries(Object.entries(entries).map(([name, data]) => [name, data])), "word/document.xml": strToU8(xml) });
        return { ...(await writeEdited(file, args.path, Buffer.from(out))), report };
      } }),
  ];
}

import { readFile } from "node:fs/promises";
import { z } from "zod";
import { defineTool, objectSchema, stringField } from "../types";
import { officeTarget, writeEdited } from "./office-shared";

const pathSchema = z.string().min(1).max(1000);
const textItemSchema = z.object({ text: z.string().max(5000), x: z.number().min(0).max(13.33).default(0.5), y: z.number().min(0).max(7.5).default(7.0), fontSize: z.number().min(8).max(72).default(18), bold: z.boolean().default(false) });
const tableItemSchema = z.object({ x: z.number().min(0).max(13.33).default(0.5), y: z.number().min(0).max(7.5).default(4), rows: z.array(z.array(z.string().max(2000))).min(1).max(50) });
const imageItemSchema = z.object({ path: pathSchema, x: z.number().min(0).max(13.33).default(0.5), y: z.number().min(0).max(7.5).default(5), w: z.number().min(0.5).max(13.33), h: z.number().min(0.3).max(7.5) });

/** Buat presentasi PowerPoint (.pptx) baru via pptxgenjs — generate-only (bukan edit file existing). */
export function createOfficePptxTools(baseDir: string) {
  return [
    defineTool({ name: "office:create_pptx", connector: "workspace", permission: "write", description: "Buat presentasi PowerPoint (.pptx) baru 16:9: slide dengan teks (posisi inci), tabel, dan gambar dari path workspace. Untuk membaca .pptx existing gunakan general:read_file. Tema warna: pilih satu dari 3 palet.", schema: z.object({ path: pathSchema, title: z.string().max(300).optional(), theme: z.enum(["professional", "dark", "minimal"]).default("professional"), slides: z.array(z.object({ title: z.string().max(300).optional(), texts: z.array(textItemSchema).max(20).default([]), table: tableItemSchema.optional(), image: imageItemSchema.optional(), notes: z.string().max(2000).optional() })).min(1).max(100) }).strict(), parameters: objectSchema({ path: stringField, title: stringField, theme: stringField, slides: { type: "array" } }, ["path", "slides"]),
      execute: async (args, run) => {
        const { default: PptxGenJS } = await import("pptxgenjs");
        const pptx = new PptxGenJS();
        pptx.layout = "LAYOUT_16x9";
        const themes = {
          professional: { titleColor: "1F3864", bg: "FFFFFF", accent: "2E74B5" },
          dark: { titleColor: "F2F2F2", bg: "1B1B1B", accent: "4472C4" },
          minimal: { titleColor: "333333", bg: "FFFFFF", accent: "666666" },
        } as const;
        const theme = themes[args.theme];
        pptx.title = args.title ?? "Presentasi";
        for (const slide of args.slides) {
          const s = pptx.addSlide();
          s.background = { color: theme.bg };
          if (slide.title) s.addText(slide.title, { x: 0.5, y: 0.3, w: 12.33, h: 0.9, fontSize: 28, bold: true, color: theme.titleColor });
          for (const item of slide.texts) s.addText(item.text, { x: item.x, y: item.y, w: Math.min(12.8 - item.x, 6), fontSize: item.fontSize, bold: item.bold, color: theme.accent });
          if (slide.table) s.addTable(slide.table.rows.map((row) => row.map((cell) => ({ text: cell }))), { x: slide.table.x, y: slide.table.y, border: { pt: 1, color: theme.accent } });
          if (slide.image) {
            const imgFile = await officeTarget(baseDir, run.userId, slide.image.path);
            const data = await readFile(imgFile);
            s.addImage({ data: `image/png;base64,${data.toString("base64")}` as never, x: slide.image.x, y: slide.image.y, w: slide.image.w, h: slide.image.h });
          }
          if (slide.notes) s.addNotes(slide.notes);
        }
        const bytes = Buffer.from(await pptx.write({ outputType: "nodebuffer" }) as Buffer);
        const file = await officeTarget(baseDir, run.userId, args.path);
        return writeEdited(file, args.path, bytes);
      } }),
  ];
}

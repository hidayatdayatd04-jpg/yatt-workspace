import { describe, expect, test } from "bun:test";
import { zipSync } from "fflate";
import { detectContentKind } from "./detect";
import { decodeText } from "./text";
import { readFileContent } from "./read";
import { extractArchiveText } from "./zip";
import { renderPdfPage } from "./pdf-pages";

function pdfFixture() {
  const content = "q 80 0 0 60 20 20 cm /Im1 Do Q";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length 7 >>\nstream\nFF0000>\nendstream"];
  let text = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(text.length); text += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = text.length;
  text += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\n`;
  return Buffer.from(text + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}
describe("File readers", () => {
  test("normalizes JSON charset and image MIME aliases using signatures", () => {
    expect(detectContentKind({ mimeType: "Application/JSON;charset=utf-8", originalName: "data.json", head: Buffer.from('{"ok":true}') }).kind).toBe("text");
    for (const mimeType of ["application/octet-stream", "image/x-png", "image/png;charset=binary", ""]) {
      expect(detectContentKind({ mimeType, originalName: "image.png", head: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) })).toMatchObject({ kind: "image", mimeType: "image/png" });
    }
    expect(detectContentKind({ mimeType: "image/gif", originalName: "image.gif", head: Buffer.from("GIF89a") }).kind).toBe("image");
    expect(detectContentKind({ mimeType: "application/json", originalName: "fake.json", head: Buffer.from([0, 1, 2]) }).ok).toBe(false);
  });
  test("reads UTF-16 and extensionless text, and pages long JSON without data loss", async () => {
    expect(decodeText(Buffer.concat([Buffer.from([255, 254]), Buffer.from("Halo dunia", "utf16le")]))).toBe("Halo dunia");
    const bytes = Buffer.from(JSON.stringify({ value: "abc".repeat(8000) }));
    let offset = 0, all = "";
    while (true) {
      const result = await readFileContent({ bytes, name: "data.json", mime: "application/json;charset=utf-8", offset });
      all += result.content ?? "";
      if (result.nextOffset === null) break;
      offset = result.nextOffset;
    }
    expect(all).toBe(bytes.toString());
    expect((await readFileContent({ bytes: Buffer.from("hello"), name: "NOTES" })).content).toBe("hello");
  });
  test("lists ZIP entries including binary and reads selected nested paths fully", async () => {
    const bytes = Buffer.from(zipSync({ "project/src/data.json": Buffer.from('{"answer":42}'), "project/picture.png": Buffer.from([0, 1, 2]), "project/README.md": Buffer.from("hello") }));
    const listed = await readFileContent({ name: "project (1).zip", bytes });
    expect(listed.entries?.length).toBe(3);
    expect((await readFileContent({ name: "project (1).zip", bytes, entryPath: "project/src/data.json" })).content).toBe('{"answer":42}');
    expect(await extractArchiveText("project.zip", bytes, 0)).toContain("project/picture.png");
    await expect(readFileContent({ name: "project.zip", bytes, entryPath: "missing" })).rejects.toThrow("tidak ditemukan");
  });
  test("rejects traversal and ZIP expansion before reading contents", async () => {
    for (const name of ["../escape.txt", "C:/escape.txt", "/escape.txt"]) {
      const bytes = Buffer.from(zipSync({ [name]: Buffer.from("no") }));
      await expect(readFileContent({ name: "unsafe.zip", bytes })).rejects.toThrow("Path tidak aman");
    }
    const bomb = Buffer.from(zipSync({ "huge.txt": new Uint8Array(25_000_001) }));
    await expect(readFileContent({ name: "bomb.zip", bytes: bomb })).rejects.toThrow("Batas ekstraksi");
  });
  test("renders a PDF diagram and supplies its actual pixels to vision", async () => {
    const bytes = pdfFixture();
    const rendered = await renderPdfPage(bytes);
    expect(rendered.bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(rendered.totalPages).toBe(1);
    const result = await readFileContent({ name: "diagram.pdf", bytes, describeImage: async (image) => {
      expect(image.mime).toBe("image/png"); expect(image.bytes.length).toBeGreaterThan(50); return "Kotak biru";
    } });
    expect(result.content).toBe("Kotak biru");
    expect(result.nextPage).toBeNull();
  });
});

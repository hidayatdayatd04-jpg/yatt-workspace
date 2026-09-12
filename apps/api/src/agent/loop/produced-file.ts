import { redactText } from "../../lib/redaction";

/** Tool yang menghasilkan file workspace — output path-nya layak diunduh user. */
const FILE_TOOLS_RE = /^(office:|archive:create$|general:import_attachment$|general:write_file$|general:extract_zip$)/;

/** Ambil path file hasil tool dari output JSON (path/destination) untuk tombol unduh. */
export function producedFilePath(fqName: string, result: { ok: boolean; output: string }): string | null {
  if (!result.ok || !FILE_TOOLS_RE.test(fqName)) return null;
  try {
    const parsed = JSON.parse(result.output) as Record<string, unknown>;
    const raw = typeof parsed.path === "string" ? parsed.path : typeof parsed.destination === "string" ? parsed.destination : null;
    if (!raw || raw.length > 1000 || /[:\x00]/.test(raw)) return null;
    return redactText(raw).replaceAll("\\", "/");
  } catch { return null; }
}

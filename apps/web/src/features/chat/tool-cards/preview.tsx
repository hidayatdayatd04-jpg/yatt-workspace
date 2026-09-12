import type { ToolCategory } from "./registry";
import { redactSecretsDeep } from "./secret-redact";

function parseJsonOutput(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Ambil subset tabel dari output JSON tool spreadsheet/data (maks 20 baris). */
function extractTable(output: string | undefined): Array<Record<string, unknown>> | null {
  const obj = parseJsonOutput(output);
  if (!obj) return null;
  const candidate = Array.isArray(obj.rows) ? obj.rows
    : Array.isArray(obj.records) ? obj.records
    : Array.isArray(obj.data) && obj.data.every((r) => r && typeof r === "object") ? obj.data
    : null;
  if (!candidate) return null;
  const rows = candidate
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && !Array.isArray(r))
    .slice(0, 20);
  return rows.length > 0 ? (redactSecretsDeep(rows) as Array<Record<string, unknown>>) : null;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function TablePreview(props: { rows: Array<Record<string, unknown>> }) {
  const columns = [...new Set(props.rows.flatMap((row) => Object.keys(row)))].slice(0, 8);
  return (
    <div className="overflow-auto rounded-xl border border-border/70">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            {columns.map((col) => (
              <th key={col} className="whitespace-nowrap px-2.5 py-1.5 font-medium">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {props.rows.map((row, i) => (
            <tr key={i} className="hover:bg-muted/30">
              {columns.map((col) => (
                <td key={col} className="max-w-[240px] truncate px-2.5 py-1.5" title={cellText(row[col])}>
                  {cellText(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** LEVEL 2 — preview readable per kategori tool (bukan JSON mentah). */
export function ToolPreview(props: { category: ToolCategory; output: string | undefined }) {
  const obj = parseJsonOutput(props.output);
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
  if (props.category === "terminal" && obj) {
    const exit = typeof obj.exitCode === "number" ? obj.exitCode : null;
    return (
      <div className="space-y-1.5">
        {exit !== null && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${exit === 0
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
            Exit Code: {exit}
          </span>
        )}
        {(str(obj.stdout) || str(obj.stderr)) && (
          <pre className="max-h-64 overflow-auto rounded-xl border border-border/70 bg-muted/30 p-3 font-mono text-xs leading-relaxed">
            {str(obj.stdout) ?? str(obj.stderr)}
          </pre>
        )}
      </div>
    );
  }
  if (props.category === "table") {
    const rows = extractTable(props.output);
    if (rows) return <TablePreview rows={rows} />;
  }
  if (obj) {
    const entries = Object.entries(obj).filter(([, v]) => v !== null && typeof v !== "object").slice(0, 8);
    if (entries.length > 0) {
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {entries.map(([k, v]) => (
            <div key={k} className="col-span-2 grid grid-cols-subgrid">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="truncate font-medium" title={cellText(v)}>{cellText(v)}</dd>
            </div>
          ))}
        </dl>
      );
    }
  }
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/30 p-3 text-xs leading-relaxed">
      {(props.output ?? "").slice(0, 2000) || "(Hasil kosong / 0 baris data)"}
    </pre>
  );
}

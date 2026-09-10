import { useRef } from "react";
import { toast } from "sonner";
import type { ConnectorDTO } from "@shared/index";
import { useSetConnectorMode, useWriteReadiness } from "@/features/connectors/connector-hooks";

/** Ekstensi file yang diterima server (selaras routes/attachments). */
const FILE_ACCEPT = [
  ".pdf", ".docx", ".xls", ".xlsx", ".pptx", ".odt", ".ods", ".odp", ".zip",
  ".txt", ".md", ".markdown", ".csv", ".tsv", ".log", ".rsc", ".json", ".yaml", ".yml",
  ".toml", ".ini", ".cfg", ".conf", ".env", ".xml", ".html", ".htm", ".css", ".scss",
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".vue", ".svelte", ".php", ".py", ".rb",
  ".go", ".rs", ".java", ".kt", ".c", ".h", ".cpp", ".hpp", ".cs", ".swift", ".sql",
  ".sh", ".bat", ".ps1", ".lua", ".dart", ".patch", ".diff",
].join(",");

export function useComposerActions(opts: {
  connector?: ConnectorDTO | null;
  disabled?: boolean;
  running: boolean;
  uploading: boolean;
  attachmentCount: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setMode = useSetConnectorMode(opts.connector?.id ?? "");
  const readiness = useWriteReadiness(opts.connector?.id ?? null);
  const writeEnabled = opts.connector?.mode === "write";
  const uploadDisabled = opts.disabled || opts.running || opts.uploading || opts.attachmentCount >= 4;

  function pickFile(images: boolean) {
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = images ? ".png,.jpg,.jpeg,.webp" : FILE_ACCEPT;
    fileInputRef.current.click();
  }

  function toggleWrite(enabled: boolean) {
    if (!opts.connector) return;
    // Never auto-enable Write on connector switch; explicit toggle only.
    setMode.mutate(
      { mode: enabled ? "write" : "read-only", expectedVersion: opts.connector.modeVersion },
      {
        onSuccess: (res) => {
          if (res.connector.mode === "write") {
            void readiness.refetch().then(({ data }) => {
              if (data?.blocked === "empty-credential") {
                toast.warning("Mode Write aktif, tetapi password admin masih kosong — tulis tetap diblokir. Isi password admin dulu.");
              } else {
                toast.success("Mode Write aktif — perintah perubahan dijalankan dalam Safe Mode.");
              }
            });
          } else {
            toast.info("Mode Read-Only aktif — konfigurasi router tidak diubah.");
          }
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return { fileInputRef, setMode, readiness, writeEnabled, uploadDisabled, pickFile, toggleWrite };
}

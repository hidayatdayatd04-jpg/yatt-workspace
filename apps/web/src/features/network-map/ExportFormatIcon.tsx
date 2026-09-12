import { FileIcon } from "@/components/file-icons";
import type { MapExportFormat } from "./network-map-export";

export function ExportFormatIcon({ format }: { format: MapExportFormat }) {
  return <span className={`map-format-icon map-format-${format}`}>
    <FileIcon fileName={`peta-topologi.${format}`} size={26} />
  </span>;
}

import { FileText, Folder } from "@/components/icons";
import { getFileIcon, getFolderIcon, getOpenFolderIcon } from "@/lib/file-icons";

export interface FileIconProps {
  /** Nama file lengkap (boleh berupa path); icon ditentukan otomatis dari nama/ekstensi. */
  fileName: string;
  size?: number;
  className?: string;
}

export interface FolderIconProps {
  /** Nama folder; folder dikenal (src, node_modules, .git, dst.) mendapat icon khusus. */
  folderName: string;
  isOpen?: boolean;
  size?: number;
  className?: string;
}

function imgClass(size: number, className?: string): string {
  return `shrink-0 object-contain ${className ?? ""}`.trim();
}

/** Icon file otomatis (vscode-icons) dengan fallback ke icon generik bila SVG tak tersedia. */
export function FileIcon({ fileName, size = 20, className }: FileIconProps) {
  const url = getFileIcon(fileName);
  if (!url) {
    return <FileText style={{ width: size, height: size }} className={imgClass(size, className)} aria-hidden="true" />;
  }
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={imgClass(size, className)}
    />
  );
}

/** Icon folder otomatis (vscode-icons) dengan varian terbuka dan fallback generik. */
export function FolderIcon({ folderName, isOpen = false, size = 20, className }: FolderIconProps) {
  const url = isOpen ? getOpenFolderIcon(folderName) : getFolderIcon(folderName);
  if (!url) {
    return <Folder style={{ width: size, height: size }} className={imgClass(size, className)} aria-hidden="true" />;
  }
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={imgClass(size, className)}
    />
  );
}

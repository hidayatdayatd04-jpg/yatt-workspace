import { CodeBlock } from "./OutputBlocks";
import { TextCanvas } from "./TextCanvas";
import type { CodeArtifactData } from "./code-artifact-data";

export type { CodeArtifactData } from "./code-artifact-data";

/** Unduh snapshot tepat seperti yang terlihat pada canvas. */
export function downloadArtifact(artifact: CodeArtifactData) {
  const url = URL.createObjectURL(new Blob([artifact.code], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = artifact.path.replaceAll("\\", "/").split("/").at(-1) || "kode.txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const TEXT_LANGUAGES = new Set(["markdown", "text"]);

export function CodeArtifact({ artifact, live = false }: { artifact: CodeArtifactData; live?: boolean }) {
  // Dokumen/prompt/markdown dirender sebagai canvas teks, bukan canvas kode.
  if (TEXT_LANGUAGES.has(artifact.language)) return <TextCanvas artifact={artifact} live={live} />;
  return <section aria-label={`Hasil kode ${artifact.path}`} className="min-w-0">
    <CodeBlock language={artifact.language} code={artifact.code} live={live} fileName={artifact.path} />
  </section>;
}

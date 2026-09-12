/** Data artefak kode murni — dipakai UI dan pengujian tanpa komponen React. */
export interface CodeArtifactData { path: string; language: string; code: string }

export function readCodeArtifact(value: unknown): CodeArtifactData | null {
  if (!value || typeof value !== "object") return null;
  const artifact = value as Record<string, unknown>;
  return typeof artifact.path === "string" && typeof artifact.language === "string"
    && typeof artifact.code === "string" && artifact.code.length <= 200_000
    ? { path: artifact.path, language: artifact.language, code: artifact.code } : null;
}

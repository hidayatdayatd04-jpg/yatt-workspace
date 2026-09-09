/**
 * Deteksi kapabilitas vision per model (pola setara supportsReasoning).
 *
 * Daftar model datang dinamis tanpa metadata kapabilitas seragam,
 * jadi deteksi bersifat heuristik berbasis nama — sengaja konservatif
 * ke arah mengizinkan: model modern umumnya multimodal, hanya keluarga
 * text-only lawas yang diblokir eksplisit.
 */

export const MAX_VISION_IMAGES = 3;
export const MAX_VISION_BYTES_PER_IMAGE = 4 * 1024 * 1024;

/** Keluarga text-only lawas yang jelas tidak mendukung gambar. */
const NON_VISION_PATTERNS: RegExp[] = [
  /deepseek[-_/]?r1/,
  /deepseek[-_/]?reasoner/,
  /(^|[^a-z0-9])r1([^a-z0-9]|$)/,
  /qwq/,
  /magistral/,
  /k2-thinking/,
  /nemotron.*think/,
  /gpt-oss/,
  /o1-mini/,
];

/** True bila model kemungkinan mendukung input gambar (image_url). */
export function supportsVision(modelId: string | null | undefined): boolean {
  const id = (modelId ?? "").trim().toLowerCase();
  if (!id) return false;
  return !NON_VISION_PATTERNS.some((re) => re.test(id));
}

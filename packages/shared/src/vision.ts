/** Deteksi nama model vision yang dikenal; model tak dikenal ditolak. */
export const MAX_VISION_IMAGES = 4;
export const MAX_VISION_BYTES_PER_IMAGE = 20 * 1024 * 1024;

const NON_VISION_PATTERNS = [
  /deepseek[-_/]?(r1|reasoner|chat|v3)/, /qwq/, /magistral/, /k2-thinking/,
  /nemotron.*think/, /gpt-oss/, /o1-mini/, /o3-mini/, /embedding/, /tts/, /whisper/,
  /gemini.*(image|tts|audio)/,
];
const VISION_PATTERNS = [
  /(^|\/)gemini-(1\.5|2(?:\.0|\.5)?|3(?:\.\d+)?)[-:]/,
  /(^|\/)claude-(3|sonnet-4|opus-4|haiku-4)/,
  /(^|\/)gpt-(4o|4\.1|4-turbo|4-vision|5)(?:[-.:]|$)/,
  /(^|\/)(o1|o3|o4-mini)(?:[-:]|$)/,
  /(^|\/)(llama[-.]?3\.2[-:]vision|llama-4[-:])/,
  /(^|\/)qwen(?:2(?:\.5)?|3)[-.]vl(?:[-:]|$)/,
  /(^|\/)(pixtral|deepseek-vl)(?:[-:]|$)/,
];

/** Heuristik nama, bukan jaminan kapabilitas endpoint atau akses API key. */
export function supportsVision(modelId: string | null | undefined): boolean {
  const id = (modelId ?? "").trim().toLowerCase();
  return !!id && !NON_VISION_PATTERNS.some((pattern) => pattern.test(id))
    && VISION_PATTERNS.some((pattern) => pattern.test(id));
}

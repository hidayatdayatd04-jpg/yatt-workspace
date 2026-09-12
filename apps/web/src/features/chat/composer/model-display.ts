/** Nama ringkas untuk tampilan; ID asli tetap dikirim ke API dan ada di tooltip. */
export function modelDisplayName(model: string): string {
  const name = model.split("/").at(-1)?.replace(/:free$/i, "") ?? model;
  return name.replace(/[-_]/g, " ").replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\bGpt\b/g, "GPT").replace(/\bGpt Oss\b/g, "GPT OSS");
}

/** Pencarian juga menerima nama penyedia agar model dengan ID sama mudah dibedakan. */
export function matchesModelQuery(model: string, provider: string, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const searchable = `${model} ${modelDisplayName(model)} ${provider}`.toLowerCase();
  return terms.every((term) => searchable.includes(term));
}

export const MODEL_MENU_CLASS = "w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-[20px] border border-border/70 bg-popover p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-0";

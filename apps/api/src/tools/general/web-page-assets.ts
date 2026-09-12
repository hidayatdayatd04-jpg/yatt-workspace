/** Kandidat gambar dari HTML yang sudah diambil; URL tetap harus diverifikasi sebelum dipakai. */
export function extractPageImages(html: string, baseUrl: string): { url: string; alt: string }[] {
  const images = new Map<string, { url: string; alt: string }>();
  for (const tag of html.matchAll(/<(?:img|meta)\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const attr of tag[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attrs[attr[1]!.toLowerCase()] = (attr[2] ?? attr[3] ?? attr[4] ?? "").replaceAll("&amp;", "&");
    }
    const socialImage = /^(og:image(?::url)?|twitter:image)$/i.test(attrs.property ?? attrs.name ?? "");
    const src = /^<img/i.test(tag[0]) ? attrs["data-src"] || attrs.src : socialImage ? attrs.content : undefined;
    if (!src) continue;
    try {
      const url = new URL(src, baseUrl);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.href.length > 2000) continue;
      images.set(url.href, { url: url.href, alt: (attrs.alt ?? "").slice(0, 200) });
    } catch { /* abaikan URL yang tidak valid */ }
    if (images.size >= 12) break;
  }
  return [...images.values()];
}

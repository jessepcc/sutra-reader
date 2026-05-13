// Plain-text search utilities extracted for use with API-rendered HTML.

/** Strip HTML tags to produce a plain searchable string. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Return char offsets in the plain-text projection where query occurs. */
export function searchHtml(html: string, query: string): number[] {
  if (!query) return [];
  const plain = htmlToPlainText(html);
  const out: number[] = [];
  let i = 0;
  while (i <= plain.length - query.length) {
    const idx = plain.indexOf(query, i);
    if (idx < 0) break;
    out.push(idx);
    i = idx + query.length;
  }
  return out;
}

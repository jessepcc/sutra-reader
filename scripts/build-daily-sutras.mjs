#!/usr/bin/env node
// Generate src/data/daily-sutras.json — the data behind the Home page's
// "常誦" shortcuts. Counts come from the CBETA Open Data API
// (https://cbdata.dila.edu.tw/stable), never guessed.
//
// Most entries are whole works whose char count is available directly in
// work_info.cjk_chars. 普門品 is the exception: it is chapter 25 of T0262
// 妙法蓮華經 (juan 7). The script slices juan 7's HTML from the chapter's
// start lb to the next chapter's start lb and counts CJK characters in the
// plain-text projection of that slice.
//
// Usage: node scripts/build-daily-sutras.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "src", "data", "daily-sutras.json");

const API = "https://cbdata.dila.edu.tw/stable";
const READ_PACE_CHARS_PER_MIN = 180; // chant pace per user preference

// Shortcuts are listed in the order they should appear on the Home page.
// `slice` lets us count a sub-section instead of the whole work; `anchor`
// is the lb that the reader URL deep-links to.
const SHORTCUTS = [
  { key: "heart",    title: "心經",       fullTitle: "般若波羅蜜多心經",         work: "T0251" },
  { key: "guanyin",  title: "普門品",     fullTitle: "妙法蓮華經・觀世音菩薩普門品", work: "T0262",
    anchor: "0056c02",
    slice: { juan: 7, fromLb: "0056c02", toLb: "0058b08" } },
  { key: "amitabha", title: "阿彌陀經",   fullTitle: "佛說阿彌陀經",             work: "T0366" },
  { key: "medicine", title: "藥師經",     fullTitle: "藥師琉璃光如來本願功德經",   work: "T0450" },
  { key: "diamond",  title: "金剛經",     fullTitle: "金剛般若波羅蜜經",         work: "T0235" },
  { key: "ksitigarbha", title: "地藏經",  fullTitle: "地藏菩薩本願經",           work: "T0412" },
];

async function fetchJson(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchJuan(work, juan) {
  return fetchJson(`/juans?edition=CBETA&work_info=1&work=${work}&juan=${juan}`);
}

function htmlToPlainText(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// CJK char count of a string (matches what CBETA reports as cjk_chars).
function countCjk(text) {
  let n = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (
      (cp >= 0x4e00 && cp <= 0x9fff) ||   // CJK Unified
      (cp >= 0x3400 && cp <= 0x4dbf) ||   // Extension A
      (cp >= 0x20000 && cp <= 0x2a6df) || // Extension B
      (cp >= 0xf900 && cp <= 0xfaff)      // Compatibility
    ) n++;
  }
  return n;
}

// Slice juan HTML from one lb anchor (inclusive) to the next (exclusive).
// `toLb` may be null/undefined to slice to the end of the juan.
function sliceByLb(html, work, fromLb, toLb) {
  // lb spans look like: <span class="lb" id="T09n0262_p0056c02">…</span>
  // We anchor on the id attribute since that's stable.
  const fileMatch = work.match(/^([A-Z]+)(\d+)$/);
  if (!fileMatch) throw new Error(`Cannot derive file id from work: ${work}`);
  // The HTML uses the volume-qualified file id (e.g. T09n0262), but the
  // `work` parameter we pass is the bare work id (T0262). Search for any
  // lb id that ends with `_p${lb}`.
  const startRe = new RegExp(`id="[^"]*_p${fromLb}"`);
  const startMatch = html.match(startRe);
  if (!startMatch) throw new Error(`Cannot locate fromLb=${fromLb} in juan`);
  const startIdx = startMatch.index;
  if (!toLb) return html.slice(startIdx);
  const endRe = new RegExp(`id="[^"]*_p${toLb}"`);
  const endMatch = html.slice(startIdx).match(endRe);
  if (!endMatch) throw new Error(`Cannot locate toLb=${toLb} in juan`);
  return html.slice(startIdx, startIdx + endMatch.index);
}

async function resolveShortcut(s) {
  if (s.slice) {
    const j = await fetchJuan(s.work, s.slice.juan);
    const html = j.results[0];
    const slice = sliceByLb(html, s.work, s.slice.fromLb, s.slice.toLb);
    const plain = htmlToPlainText(slice);
    const chars = countCjk(plain);
    // Build a synthetic id that maps to our catalog id format: e.g. T09n0262.
    const file = j.work_info.file;
    return {
      key: s.key,
      title: s.title,
      fullTitle: s.fullTitle,
      textId: file,
      anchor: s.anchor,
      chars,
      readMinutes: Math.max(1, Math.ceil(chars / READ_PACE_CHARS_PER_MIN)),
      source: { work: s.work, sliceJuan: s.slice.juan, fromLb: s.slice.fromLb, toLb: s.slice.toLb },
    };
  }
  // Whole work: trust work_info.cjk_chars from the first juan call.
  const j = await fetchJuan(s.work, 1);
  const chars = j.work_info.cjk_chars;
  if (typeof chars !== "number") throw new Error(`No cjk_chars for ${s.work}`);
  return {
    key: s.key,
    title: s.title,
    fullTitle: s.fullTitle,
    textId: j.work_info.file,
    chars,
    readMinutes: Math.max(1, Math.ceil(chars / READ_PACE_CHARS_PER_MIN)),
    source: { work: s.work, cjkCharsFromApi: true },
  };
}

async function main() {
  const items = [];
  for (const s of SHORTCUTS) {
    process.stderr.write(`fetching ${s.work} (${s.title})… `);
    const r = await resolveShortcut(s);
    items.push(r);
    process.stderr.write(`${r.chars} 字, 約 ${r.readMinutes} 分\n`);
  }
  const out = {
    generatedAt: new Date().toISOString(),
    pace: `${READ_PACE_CHARS_PER_MIN}-chars-per-min`,
    items,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  process.stderr.write(`\nWrote ${OUT}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

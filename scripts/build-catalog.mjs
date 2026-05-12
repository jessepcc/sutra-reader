#!/usr/bin/env node
// Generate src/data/catalog.json from a local checkout of cbeta-org/xml-p5.
//
// Usage:
//   node scripts/build-catalog.mjs <path-to-xml-p5-root> [--upstream-sha=<ref>]
//
// Strategy: walk the local tree (no network for content), parse each TEI
// header for the zh-Hant work title, and emit catalog.json conforming to
// the existing shape consumed by src/lib/catalog-context.ts. Gated canons
// (LC) and gated volume prefixes (Y, YP, TX) are excluded so the runtime
// filterGated pass becomes a no-op.

import { readdirSync, readFileSync, writeFileSync, openSync, readSync, closeSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.argv[2] ?? "");
if (!repoRoot) {
  console.error("usage: node scripts/build-catalog.mjs <path-to-xml-p5-root>");
  process.exit(2);
}

const upstreamSha = (process.argv.find((a) => a.startsWith("--upstream-sha=")) ?? "")
  .split("=")[1] ?? "master";

// Mirrors src/lib/catalog.ts. Kept in lockstep manually; if you change either,
// change both.
const GATED_CANON_IDS = new Set(["LC", "Y", "YP", "TX"]);

const upstreamCanonsPath = join(repoRoot, "canons.json");
const upstreamCanons = JSON.parse(readFileSync(upstreamCanonsPath, "utf8"));

// Walk top-level canon dirs, then each volume dir, then each XML file.
const canonsOut = [];
const volumesSet = new Set();
const volumesOut = [];
const textsOut = [];

const HEADER_BYTES = 4096;
const headerBuf = Buffer.allocUnsafe(HEADER_BYTES);

function readHead(absPath) {
  const fd = openSync(absPath, "r");
  try {
    const n = readSync(fd, headerBuf, 0, HEADER_BYTES, 0);
    return headerBuf.slice(0, n).toString("utf8");
  } finally {
    closeSync(fd);
  }
}

// Inline content may contain TEI tags (notably <g ref="..."/> for gaiji),
// so we capture lazily up to </title> and strip embedded tags afterwards.
const TITLE_PATTERNS = [
  /<title\s+level="m"\s+xml:lang="zh-Hant">([\s\S]*?)<\/title>/,
  /<title\s+xml:lang="zh-Hant"\s+level="m">([\s\S]*?)<\/title>/,
  /<title\s+level="a"\s+xml:lang="zh-Hant">([\s\S]*?)<\/title>/,
  /<title\s+xml:lang="zh-Hant"\s+level="a">([\s\S]*?)<\/title>/,
  /<title\s+level="m">([\s\S]*?)<\/title>/,
];

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Replace unresolved gaiji (and any other inline element) with a placeholder
// glyph so the title still reads meaningfully. Resolution against gaiji.json
// is a separate enrichment pass.
function normalizeInline(s) {
  return s
    .replace(/<g\b[^>]*\/>/g, "□")
    .replace(/<g\b[^>]*>[\s\S]*?<\/g>/g, "□")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(head, fallback) {
  for (const re of TITLE_PATTERNS) {
    const m = re.exec(head);
    if (m) {
      const t = normalizeInline(decodeEntities(m[1]));
      if (t) return t;
    }
  }
  return fallback;
}

// Discover canons present on disk that also exist in upstream canons.json.
const onDisk = readdirSync(repoRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^[A-Z]+$/.test(e.name))
  .map((e) => e.name)
  .sort();

let missingTitleCount = 0;

for (const canonId of onDisk) {
  if (GATED_CANON_IDS.has(canonId)) continue;
  const meta = upstreamCanons[canonId];
  if (!meta) {
    console.warn(`skipping ${canonId}: not in upstream canons.json`);
    continue;
  }

  canonsOut.push({
    id: canonId,
    abbr: canonId,
    name: meta["title-zh"] ?? canonId,
    description: meta.title
      ? `${meta.title}${meta["short-title-zh"] ? ` — ${meta["short-title-zh"]}` : ""}`
      : (meta["short-title-zh"] ?? ""),
  });

  const canonDir = join(repoRoot, canonId);
  const volumeDirs = readdirSync(canonDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  for (const volumeId of volumeDirs) {
    if (!volumesSet.has(volumeId)) {
      volumesSet.add(volumeId);
      volumesOut.push({ canon: canonId, id: volumeId, label: volumeId });
    }
    const volDir = join(canonDir, volumeId);
    const xmlFiles = readdirSync(volDir)
      .filter((f) => f.endsWith(".xml"))
      .sort();
    for (const fname of xmlFiles) {
      const id = fname.slice(0, -4);
      const abs = join(volDir, fname);
      const head = readHead(abs);
      const title = extractTitle(head, id);
      if (title === id) missingTitleCount++;
      textsOut.push({
        canon: canonId,
        volume: volumeId,
        id,
        title,
        path: `${canonId}/${volumeId}/${fname}`,
        sha: upstreamSha,
        bytes: 0,
      });
    }
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  upstreamSha,
  canons: canonsOut,
  volumes: volumesOut,
  texts: textsOut,
};

const outPath = join(process.cwd(), "src/data/catalog.json");
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

console.log(
  `wrote ${outPath}\n` +
    `  canons: ${canonsOut.length}\n` +
    `  volumes: ${volumesOut.length}\n` +
    `  texts: ${textsOut.length}\n` +
    `  texts without zh-Hant title (fell back to id): ${missingTitleCount}`,
);

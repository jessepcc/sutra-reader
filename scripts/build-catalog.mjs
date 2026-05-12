#!/usr/bin/env node
// Generate catalog shards + manifest from cbeta-org/xml-p5 metadata or a local checkout.
//
// Usage:
//   node scripts/build-catalog.mjs <path-to-xml-p5-root> [--upstream-sha=<commit>]
//   node scripts/build-catalog.mjs --from-github-tree=<commit>
//
// Strategy: walk the local tree when available (no network for content), parse
// each TEI header for the zh-Hant work title, and emit:
//   public/catalog/index.json
//   public/catalog/volumes/<volume>.json
//   public/manifest.json
//   src/data/catalog.json (legacy/source artifact)
// Gated canons (LC) and gated volume prefixes (Y, YP, TX) are excluded.
//
// If only source metadata needs refreshing, --from-github-tree updates the
// existing generated catalog with blob SHAs and file sizes from the pinned
// GitHub tree. It does not download TEI content.

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const githubTreeArg = process.argv.find((a) => a.startsWith("--from-github-tree="));
const githubTreeSha = githubTreeArg?.split("=")[1] ?? "";
const args = process.argv.slice(2);
const repoArg = args.find((a) => !a.startsWith("--"));
const repoRoot = repoArg ? resolve(repoArg) : "";
if (!repoRoot && !githubTreeSha) {
  console.error(
    "usage: node scripts/build-catalog.mjs <path-to-xml-p5-root> [--upstream-sha=<commit>]\n" +
      "   or: node scripts/build-catalog.mjs --from-github-tree=<commit>",
  );
  process.exit(2);
}

function discoverCommitSha() {
  const explicit = (process.argv.find((a) => a.startsWith("--upstream-sha=")) ?? "")
    .split("=")[1];
  if (explicit) return explicit;
  if (githubTreeSha) return githubTreeSha;
  try {
    return execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function blobSha(absPath) {
  return execFileSync("git", ["-C", repoRoot, "hash-object", absPath], {
    encoding: "utf8",
  }).trim();
}

const upstreamSha = discoverCommitSha();
if (!/^[0-9a-f]{40}$/i.test(upstreamSha)) {
  console.error("A real upstream commit SHA is required. Pass --upstream-sha=<40-char-sha> or run against a git checkout.");
  process.exit(2);
}

// Mirrors src/lib/catalog.ts. Kept in lockstep manually; if you change either,
// change both.
const GATED_CANON_IDS = new Set(["LC", "Y", "YP", "TX"]);

const outPath = join(process.cwd(), "src/data/catalog.json");
const publicDir = join(process.cwd(), "public");
const catalogDir = join(publicDir, "catalog");
const volumesDir = join(catalogDir, "volumes");

async function fetchGithubTree(sha) {
  const url = `https://api.github.com/repos/cbeta-org/xml-p5/git/trees/${sha}?recursive=1`;
  const res = await fetch(url, { headers: { "user-agent": "sutra-reader-catalog-build" } });
  if (!res.ok) {
    throw new Error(`GitHub tree unavailable: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (data.truncated) {
    throw new Error("GitHub tree response was truncated; use a local checkout instead.");
  }
  return new Map(
    data.tree
      .filter((entry) => entry.type === "blob" && entry.path.endsWith(".xml"))
      .map((entry) => [entry.path, { sha: entry.sha, bytes: entry.size ?? 0 }]),
  );
}

function writeGenerated(out) {
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

  if (existsSync(catalogDir)) rmSync(catalogDir, { recursive: true, force: true });
  mkdirSync(volumesDir, { recursive: true });

  writeFileSync(
    join(catalogDir, "index.json"),
    JSON.stringify(
      {
        generatedAt: out.generatedAt,
        upstreamSha: out.upstreamSha,
        canons: out.canons,
        volumes: out.volumes,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  for (const volume of out.volumes) {
    const texts = out.texts.filter((t) => t.volume === volume.id);
    writeFileSync(
      join(volumesDir, `${volume.id}.json`),
      JSON.stringify(texts, null, 2) + "\n",
      "utf8",
    );
  }

  writeFileSync(
    join(publicDir, "manifest.json"),
    JSON.stringify(
      {
        generatedAt: out.generatedAt,
        upstreamSha: out.upstreamSha,
        files: out.texts.map(({ path, sha, bytes }) => ({ path, sha, bytes })),
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

if (githubTreeSha) {
  const current = JSON.parse(readFileSync(outPath, "utf8"));
  const tree = await fetchGithubTree(upstreamSha);
  let missing = 0;
  const texts = current.texts.map((text) => {
    const meta = tree.get(text.path);
    if (!meta) {
      missing++;
      return text;
    }
    return { ...text, sha: meta.sha, sourceSha: upstreamSha, bytes: meta.bytes };
  });
  const out = {
    ...current,
    generatedAt: new Date().toISOString(),
    upstreamSha,
    texts,
  };
  writeGenerated(out);
  console.log(
    `updated ${outPath} from GitHub tree ${upstreamSha}\n` +
      `  public catalog: ${catalogDir}\n` +
      `  manifest: ${join(publicDir, "manifest.json")}\n` +
      `  texts: ${texts.length}\n` +
      `  paths missing from GitHub tree: ${missing}`,
  );
  process.exit(missing ? 1 : 0);
}

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
      const bytes = statSync(abs).size;
      textsOut.push({
        canon: canonId,
        volume: volumeId,
        id,
        title,
        path: `${canonId}/${volumeId}/${fname}`,
        sha: blobSha(abs),
        sourceSha: upstreamSha,
        bytes,
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

writeGenerated(out);

console.log(
  `wrote ${outPath}\n` +
    `  public catalog: ${catalogDir}\n` +
    `  manifest: ${join(publicDir, "manifest.json")}\n` +
    `  canons: ${canonsOut.length}\n` +
    `  volumes: ${volumesOut.length}\n` +
    `  texts: ${textsOut.length}\n` +
    `  texts without zh-Hant title (fell back to id): ${missingTitleCount}`,
);

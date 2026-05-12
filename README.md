# 經閣 / Sutra Reader

A mobile-first Progressive Web App for reading the
[CBETA Chinese Buddhist canon](https://github.com/cbeta-org/xml-p5).
Visual language: Japanese zen / wabi-sabi. Open source. **Local-only — no
accounts, no analytics, no telemetry.**

> ⚖️ **Non-commercial only.** Text content is licensed
> [CC BY-NC-SA 3.0 TW](https://cbeta.org/copyright) by the CBETA Foundation.
> The MIT licence on this repo covers the *app code* only; commercial
> redeployment of this app with CBETA content violates the content licence.
> See [NOTICE.md](./NOTICE.md).

## What you get

- Browse 藏 → 冊 → 經 from app-hosted lazy catalog shards
- Read TEI-rendered sutras with line / page markers (`lb`, `pb`) preserved
- Vertical RTL (`writing-mode: vertical-rl`) by default; horizontal LTR toggle
- Three paper modes: 紙 (washi) / 墨 (sumi-inverted) / 灰 (ash)
- 收藏 saved-list and per-position 標記 bookmarks
- Offline reading of opened texts; saved texts are opportunistically pre-cached
- Update checks against a generated upstream manifest for cached texts
- Installable PWA (Workbox service worker, app shell + catalog/XML cache)

## Stack

Vite + React + React Router + TypeScript · `idb` for IndexedDB · `fast-xml-parser`
for TEI · `vite-plugin-pwa` for the service worker · Vitest for tests
(`fake-indexeddb` + jsdom).

## Develop

```sh
npm install
npm run dev         # vite dev server
npm test            # vitest run
npm run coverage    # v8 coverage with 70% gate on src/lib/**
npm run build       # production bundle + PWA service worker
```

Builds default to GitHub Pages project hosting at `/sutra-reader/`. For a root
host such as Cloudflare Pages, build with:

```sh
VITE_BASE_PATH=/ npm run build
```

## Architecture

```
src/lib        # pure logic, fully unit-tested
  catalog.ts   # gated-canon filtering, raw GitHub URLs, manifest diff
  tei.ts       # TEI P5 → HTML transform (juan, lb, gaiji, choice, app)
  db.ts        # idb-backed CRUD for texts (LRU), saved, bookmarks, recents, settings
  fetcher.ts   # cache-first text load with eviction
src/ui         # React components & pages
src/data       # generated catalog source artifact + gaiji table
public/catalog # generated lazy-loaded catalog index + per-volume shards
scripts        # build-time tools
  build-catalog.mjs  # regenerate catalog shards + manifest from xml-p5 metadata/content
```

### Regenerating the catalog

```bash
# 1. Download upstream
curl -L https://codeload.github.com/cbeta-org/xml-p5/tar.gz/refs/heads/master \
  -o /tmp/xml-p5.tar.gz
mkdir -p /tmp/xml-p5 && tar -xzf /tmp/xml-p5.tar.gz -C /tmp/xml-p5 --strip-components=1

# 2. Generate
node scripts/build-catalog.mjs /tmp/xml-p5

# Or refresh blob SHAs/sizes from GitHub tree metadata without downloading XML
node scripts/build-catalog.mjs --from-github-tree=<40-char-upstream-commit>
```

## Privacy

This app does **not**:
- Send any telemetry, analytics, or fingerprinting beacons.
- Load any third-party script.
- Use cookies or `localStorage` for anything beyond a 1-byte theme bootstrap.

The **only** outbound calls are:
- `raw.githubusercontent.com/cbeta-org/xml-p5/<commit>/...` to fetch TEI XML once per
  text, then served from IndexedDB.
- The app-hosted `/manifest.json` and `/catalog/**.json` files when browsing or
  tapping **檢查更新**.

## Contributing

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md). No analytics, no ads, no
tracking — those PRs will be closed without discussion.

## Spec

See [SPEC.md](./SPEC.md) for the full v0.3 product specification.

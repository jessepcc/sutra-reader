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

## Deploy

Hosting is **Cloudflare Pages** with Git integration — every push to `main`
triggers an automatic build and deploy. No manual steps needed after initial
setup.

The `functions/api/cbeta/[[path]].ts` Pages Function proxies
[the CBETA Open Data API](https://cbdata.dila.edu.tw/) at `/api/cbeta/*`.
The proxy is required because CBETA only emits `Access-Control-Allow-Origin`
for `Origin: https://cbeta.org`. Cloudflare Pages detects and deploys the
`functions/` directory automatically alongside the static assets.

**Cloudflare Pages project settings:**

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Deploy command | *(leave blank)* |

For a one-off manual deploy (e.g. from a local branch):

```sh
npm run build
npm run deploy      # wrangler pages deploy dist --project-name sutra-reader
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
- `/api/cbeta/*` (same-origin Pages Function) → `cbdata.dila.edu.tw` to fetch
  sutra text once per text, then served from IndexedDB.
- The app-hosted `/catalog/**.json` files when browsing the canon.

## Contributing

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md). No analytics, no ads, no
tracking — those PRs will be closed without discussion.

## Spec

See [SPEC.md](./SPEC.md) for the full v0.3 product specification.

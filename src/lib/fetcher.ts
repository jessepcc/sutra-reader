// Fetch + cache layer. Calls the CBETA official API and stores rendered HTML
// in IndexedDB. Cache-first with TTL-based staleness detection.

import { fetchAllJuans, textIdToWorkId } from "./cbeta-api";
import { evictLRU, getStoredText, putStoredText, touchStoredText } from "./db";
import { DEFAULT_SETTINGS, type RenderResult, type TextEntry } from "./types";

// Cached content is considered fresh for 30 days.
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface FetchOptions {
  /** Override the global fetch (for tests). */
  fetcher?: typeof fetch;
  /** Force network even if cached. */
  forceNetwork?: boolean;
  /** LRU cap; defaults to DEFAULT_SETTINGS.cacheCapBytes. */
  cacheCapBytes?: number;
}

export interface LoadedText {
  entry: TextEntry;
  rendered: RenderResult;
  fromCache: boolean;
  stale: boolean;
}

export async function loadText(
  entry: TextEntry,
  opts: FetchOptions = {},
): Promise<LoadedText> {
  const workId = textIdToWorkId(entry.id);
  const now = Date.now();

  const cached = !opts.forceNetwork ? await getStoredText(entry.id) : undefined;
  const isFresh = cached && cached.cachedAt > 0 && now - cached.cachedAt < CACHE_TTL_MS;

  if (cached && isFresh) {
    await touchStoredText(entry.id);
    return {
      entry,
      rendered: storedToRendered(cached.htmlFragments),
      fromCache: true,
      stale: false,
    };
  }

  // Stale-but-cached: serve old content while marking stale.
  // If the network call below fails, fall back to cached data.
  const f = opts.fetcher ?? fetch;
  let htmlFragments: string[];
  let title: string;
  let juanCount: number;
  let fetchFailed = false;

  try {
    const { htmlFragments: frags, workInfo } = await fetchAllJuans(workId, f);
    htmlFragments = frags;
    title = workInfo.title;
    juanCount = frags.length;
  } catch (err) {
    if (cached) {
      await touchStoredText(entry.id);
      return {
        entry,
        rendered: storedToRendered(cached.htmlFragments),
        fromCache: true,
        stale: true,
      };
    }
    throw err;
  }

  if (!fetchFailed) {
    const bytes = htmlFragments.reduce(
      (sum, h) => sum + new TextEncoder().encode(h).length,
      0,
    );
    await putStoredText({
      textId: entry.id,
      workId,
      title,
      juanCount,
      htmlFragments,
      cachedAt: now,
      lastAccessed: now,
      bytes,
    });
    const cap = opts.cacheCapBytes ?? DEFAULT_SETTINGS.cacheCapBytes;
    await evictLRU(cap);
  }

  return {
    entry,
    rendered: storedToRendered(htmlFragments),
    fromCache: false,
    stale: false,
  };
}

function storedToRendered(htmlFragments: string[]): RenderResult {
  return {
    juans: htmlFragments.map((html, i) => ({ id: String(i + 1), html })),
  };
}

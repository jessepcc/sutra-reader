// Fetch + cache layer for TEI XML text bodies.
// Cache-first against IndexedDB, falling back to raw GitHub pinned-SHA URL.

import { rawGitHubUrl } from "./catalog";
import {
  clearStoredTextStale,
  evictLRU,
  getStoredText,
  putStoredText,
  touchStoredText,
} from "./db";
import { renderTei, type GaijiTable, type RenderResult } from "./tei";
import { DEFAULT_SETTINGS, type TextEntry } from "./types";

export interface FetchOptions {
  /** Override the global fetch (for tests). */
  fetcher?: typeof fetch;
  /** Force network even if cached. */
  forceNetwork?: boolean;
  /** Gaiji table to pass to the renderer. */
  gaiji?: GaijiTable;
  /** LRU cap; defaults to DEFAULT_SETTINGS.cacheCapBytes. */
  cacheCapBytes?: number;
}

export interface LoadedText {
  entry: TextEntry;
  xml: string;
  rendered: RenderResult;
  fromCache: boolean;
  stale: boolean;
}

export async function loadText(
  entry: TextEntry,
  opts: FetchOptions = {},
): Promise<LoadedText> {
  const cached = !opts.forceNetwork ? await getStoredText(entry.id) : undefined;
  if (cached && cached.sha === entry.sha && !cached.staleSha) {
    await touchStoredText(entry.id);
    const rendered = renderTei(cached.xml, opts.gaiji);
    return {
      entry,
      xml: cached.xml,
      rendered,
      fromCache: true,
      stale: cached.staleSha !== undefined && cached.staleSha !== cached.sha,
    };
  }

  const fetchEntry =
    cached?.staleSha && cached.staleSourceSha
      ? {
          ...entry,
          sha: cached.staleSha,
          sourceSha: cached.staleSourceSha,
          bytes: cached.staleBytes ?? entry.bytes,
        }
      : entry;
  const url = rawGitHubUrl(fetchEntry);
  const f = opts.fetcher ?? fetch;
  let res: Response;
  try {
    res = await f(url);
  } catch (err) {
    if (cached) {
      await touchStoredText(entry.id);
      return {
        entry,
        xml: cached.xml,
        rendered: renderTei(cached.xml, opts.gaiji),
        fromCache: true,
        stale: true,
      };
    }
    throw err;
  }
  if (!res.ok) {
    if (cached) {
      await touchStoredText(entry.id);
      return {
        entry,
        xml: cached.xml,
        rendered: renderTei(cached.xml, opts.gaiji),
        fromCache: true,
        stale: true,
      };
    }
    throw new Error(`Failed to fetch ${entry.id}: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  const rendered = renderTei(xml, opts.gaiji);

  await putStoredText({
    textId: entry.id,
    path: fetchEntry.path,
    sha: fetchEntry.sha,
    sourceSha: fetchEntry.sourceSha,
    xml,
    htmlFragments: rendered.juans.map((j) => j.html),
    lastAccessed: Date.now(),
    bytes: new TextEncoder().encode(xml).length,
  });
  await clearStoredTextStale(entry.id);

  const cap = opts.cacheCapBytes ?? DEFAULT_SETTINGS.cacheCapBytes;
  await evictLRU(cap);

  return { entry: fetchEntry, xml, rendered, fromCache: false, stale: false };
}

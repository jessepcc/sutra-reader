// Fetch + cache layer for TEI XML text bodies.
// Cache-first against IndexedDB, falling back to jsDelivr pinned-SHA URL.

import { jsDelivrUrl } from "./catalog";
import { evictLRU, getStoredText, putStoredText, touchStoredText } from "./db";
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
}

export async function loadText(
  entry: TextEntry,
  opts: FetchOptions = {},
): Promise<LoadedText> {
  const cached = !opts.forceNetwork ? await getStoredText(entry.id) : undefined;
  if (cached && cached.sha === entry.sha) {
    await touchStoredText(entry.id);
    const rendered = renderTei(cached.xml, opts.gaiji);
    return { entry, xml: cached.xml, rendered, fromCache: true };
  }

  const url = jsDelivrUrl(entry);
  const f = opts.fetcher ?? fetch;
  const res = await f(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${entry.id}: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  const rendered = renderTei(xml, opts.gaiji);

  await putStoredText({
    textId: entry.id,
    sha: entry.sha,
    xml,
    htmlFragments: rendered.juans.map((j) => j.html),
    lastAccessed: Date.now(),
    bytes: new TextEncoder().encode(xml).length,
  });

  const cap = opts.cacheCapBytes ?? DEFAULT_SETTINGS.cacheCapBytes;
  await evictLRU(cap);

  return { entry, xml, rendered, fromCache: false };
}

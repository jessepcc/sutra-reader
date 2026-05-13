import { findTextById } from "./catalog-context";
import { getBookmarks, getSaved, getStoredText, getStoredTexts, patchSettings } from "./db";
import { CACHE_TTL_MS, loadText } from "./fetcher";
import dailySutras from "../data/daily-sutras.json";

const PRECACHE_KEY = "sutra-precachedAt";
const PRECACHE_INTERVAL_MS = 24 * 60 * 60 * 1000;

function shouldRunPrecache(): boolean {
  const last = Number(localStorage.getItem(PRECACHE_KEY) ?? 0);
  return Date.now() - last > PRECACHE_INTERVAL_MS;
}

function markPrecacheDone(): void {
  localStorage.setItem(PRECACHE_KEY, String(Date.now()));
}

export interface UpdateCheckResult {
  expiredCount: number;
}

/** Return the number of cached texts whose TTL has elapsed. */
export async function checkCachedTextUpdates(): Promise<UpdateCheckResult> {
  const now = Date.now();
  const cached = await getStoredTexts();
  const expired = cached.filter((t) => t.cachedAt === 0 || now - t.cachedAt >= CACHE_TTL_MS);
  return { expiredCount: expired.length };
}

export async function precacheSavedText(textId: string): Promise<void> {
  if (!navigator.onLine) return;
  const entry = await findTextById(textId);
  if (!entry) return;
  await loadText(entry);
}

export async function precacheSavedTexts(): Promise<number> {
  if (!navigator.onLine) return 0;
  const saved = await getSaved();
  let count = 0;
  for (const item of saved) {
    try {
      await precacheSavedText(item.textId);
      count++;
    } catch {
      // Best-effort background cache.
    }
  }
  return count;
}

export async function applyAutoUpdateSetting(autoUpdate: boolean): Promise<void> {
  await patchSettings({ autoUpdate });
  if (autoUpdate) void precacheSavedTexts();
}

async function precacheTextId(textId: string): Promise<void> {
  const stored = await getStoredText(textId);
  if (stored && stored.cachedAt > 0 && Date.now() - stored.cachedAt < CACHE_TTL_MS) return;
  const entry = await findTextById(textId);
  if (!entry) return;
  await loadText(entry);
}

/** Precache the 6 常誦 sutras shown on the home page. */
export async function precacheDailySutras(): Promise<void> {
  if (!navigator.onLine) return;
  if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
  for (const sutra of dailySutras.items) {
    try {
      await precacheTextId(sutra.textId);
    } catch { /* best effort */ }
  }
}

/** Precache texts that have bookmarks but may have been evicted from the LRU. */
export async function precacheBookmarkedTexts(): Promise<void> {
  if (!navigator.onLine) return;
  if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
  const bookmarks = await getBookmarks();
  const textIds = [...new Set(bookmarks.map((b) => b.textId))];
  for (const textId of textIds) {
    try {
      await precacheTextId(textId);
    } catch { /* best effort */ }
  }
}

/**
 * Run daily-sutra and bookmark precaching at most once per 24 h.
 * Fire-and-forget; safe to call without awaiting.
 */
export function runBackgroundPrecache(): void {
  if (!shouldRunPrecache()) return;
  markPrecacheDone();
  void precacheDailySutras();
  void precacheBookmarkedTexts();
}

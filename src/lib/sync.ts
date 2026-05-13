import { findTextById } from "./catalog-context";
import { getSaved, getStoredTexts, patchSettings } from "./db";
import { CACHE_TTL_MS, loadText } from "./fetcher";

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

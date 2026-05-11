// Export / import — compensates for the lack of accounts (SPEC.md §5.3).
// Last-write-wins merge by timestamp.

import {
  addBookmark,
  bookmarkKey,
  getBookmarks,
  getRecents,
  getSaved,
  getSettings,
  putSettings,
  recordRecent,
  toggleSaved,
} from "./db";
import {
  type Bookmark,
  DEFAULT_SETTINGS,
  type ExportBundle,
  type RecentEntry,
  type SavedEntry,
  type Settings,
} from "./types";

export async function buildExport(): Promise<ExportBundle> {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    saved: await getSaved(),
    bookmarks: await getBookmarks(),
    recents: await getRecents(),
    settings: await getSettings(),
  };
}

export function validateBundle(input: unknown): input is ExportBundle {
  if (!input || typeof input !== "object") return false;
  const b = input as Partial<ExportBundle>;
  if (b.version !== 1) return false;
  if (!Array.isArray(b.saved)) return false;
  if (!Array.isArray(b.bookmarks)) return false;
  if (!Array.isArray(b.recents)) return false;
  if (!b.settings || typeof b.settings !== "object") return false;
  return true;
}

/**
 * Merge an export bundle into the current store. Pure merge logic
 * (no IndexedDB) is split out as `mergeBundles` for testability.
 */
export function mergeBundles(current: ExportBundle, incoming: ExportBundle): ExportBundle {
  // saved: union by textId, keep the entry with the later savedAt
  const savedBy = new Map<string, SavedEntry>();
  for (const s of current.saved) savedBy.set(s.textId, s);
  for (const s of incoming.saved) {
    const existing = savedBy.get(s.textId);
    if (!existing || s.savedAt > existing.savedAt) savedBy.set(s.textId, s);
  }

  // bookmarks: union by {textId, lb}, keep the entry with the later createdAt
  const bookmarkBy = new Map<string, Bookmark>();
  for (const b of current.bookmarks) bookmarkBy.set(bookmarkKey(b), b);
  for (const b of incoming.bookmarks) {
    const k = bookmarkKey(b);
    const existing = bookmarkBy.get(k);
    if (!existing || b.createdAt > existing.createdAt) bookmarkBy.set(k, b);
  }

  // recents: union by textId, keep the entry with the later openedAt
  const recentBy = new Map<string, RecentEntry>();
  for (const r of current.recents) recentBy.set(r.textId, r);
  for (const r of incoming.recents) {
    const existing = recentBy.get(r.textId);
    if (!existing || r.openedAt > existing.openedAt) recentBy.set(r.textId, r);
  }

  // settings: take whichever bundle was saved more recently. Falls back to
  // incoming on missing timestamps so explicit imports win.
  const settings: Settings = pickNewer(current, incoming).settings;

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    saved: [...savedBy.values()].sort((a, b) => b.savedAt - a.savedAt),
    bookmarks: [...bookmarkBy.values()].sort((a, b) => b.createdAt - a.createdAt),
    recents: [...recentBy.values()].sort((a, b) => b.openedAt - a.openedAt),
    settings,
  };
}

function pickNewer(a: ExportBundle, b: ExportBundle): ExportBundle {
  const ta = Date.parse(a.savedAt);
  const tb = Date.parse(b.savedAt);
  if (Number.isNaN(ta)) return b;
  if (Number.isNaN(tb)) return a;
  return tb >= ta ? b : a;
}

/** Apply an export bundle to IndexedDB, merging with current state. */
export async function importBundle(incoming: unknown): Promise<ExportBundle> {
  if (!validateBundle(incoming)) {
    throw new Error("Invalid backup file: schema mismatch.");
  }
  const current = await buildExport();
  const merged = mergeBundles(current, incoming);

  // saved: ensure presence of each merged entry
  const currentSavedIds = new Set(current.saved.map((s) => s.textId));
  for (const s of merged.saved) {
    if (!currentSavedIds.has(s.textId)) await toggleSaved(s.textId);
  }
  for (const s of current.saved) {
    if (!merged.saved.find((m) => m.textId === s.textId)) await toggleSaved(s.textId);
  }

  // bookmarks: overwrite by composite key
  for (const b of merged.bookmarks) {
    await addBookmark(b);
  }

  // recents: just record the union (cap is enforced by recordRecent)
  for (const r of merged.recents) {
    await recordRecent(r);
  }

  await putSettings({ ...DEFAULT_SETTINGS, ...merged.settings });
  return merged;
}

/** Serialize a bundle for download. Deterministic stable JSON for testing. */
export function bundleToJson(b: ExportBundle, pretty = true): string {
  return pretty ? JSON.stringify(b, null, 2) : JSON.stringify(b);
}

export function parseBundle(text: string): ExportBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid backup file: ${(err as Error).message}`);
  }
  if (!validateBundle(parsed)) {
    throw new Error("Invalid backup file: schema mismatch.");
  }
  return parsed;
}

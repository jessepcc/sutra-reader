// IndexedDB-backed persistence for the sutra reader.
// All durable state (texts cache, saved, bookmarks, recents, settings) lives
// here — see SPEC.md §5.1.

import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import {
  type Bookmark,
  DEFAULT_SETTINGS,
  type RecentEntry,
  type SavedEntry,
  type Settings,
  type StoredText,
} from "./types";

export const DB_NAME = "sutra-reader";
export const DB_VERSION = 1;

interface SchemaV1 extends DBSchema {
  texts: {
    key: string;
    value: StoredText;
    indexes: { lastAccessed: number };
  };
  saved: { key: string; value: SavedEntry };
  bookmarks: { key: string; value: Bookmark & { key: string } };
  recents: { key: string; value: RecentEntry };
  settings: { key: "current"; value: Settings };
}

export const RECENTS_LIMIT = 50;

let dbPromise: Promise<IDBPDatabase<SchemaV1>> | null = null;

export function bookmarkKey(b: { textId: string; lb: string }): string {
  return `${b.textId}#${b.lb}`;
}

export function getDb(): Promise<IDBPDatabase<SchemaV1>> {
  if (!dbPromise) {
    dbPromise = openDB<SchemaV1>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("texts")) {
          const s = db.createObjectStore("texts", { keyPath: "textId" });
          s.createIndex("lastAccessed", "lastAccessed");
        }
        if (!db.objectStoreNames.contains("saved")) {
          db.createObjectStore("saved", { keyPath: "textId" });
        }
        if (!db.objectStoreNames.contains("bookmarks")) {
          db.createObjectStore("bookmarks", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("recents")) {
          db.createObjectStore("recents", { keyPath: "textId" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings");
        }
      },
    });
  }
  return dbPromise;
}

/** For tests: reset the cached connection (caller must close the DB). */
export function _resetDbForTests(): void {
  dbPromise = null;
}

// ──────────────── texts (LRU cache) ────────────────

export async function getStoredText(textId: string): Promise<StoredText | undefined> {
  const db = await getDb();
  return db.get("texts", textId);
}

export async function getStoredTexts(): Promise<StoredText[]> {
  const db = await getDb();
  return db.getAll("texts");
}

export async function putStoredText(text: StoredText): Promise<void> {
  const db = await getDb();
  await db.put("texts", text);
}

export async function touchStoredText(textId: string, ts = Date.now()): Promise<void> {
  const db = await getDb();
  const existing = await db.get("texts", textId);
  if (!existing) return;
  await db.put("texts", { ...existing, lastAccessed: ts });
}

/** Force re-fetch on next open by zeroing cachedAt. */
export async function expireCachedText(textId: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get("texts", textId);
  if (!existing) return;
  await db.put("texts", { ...existing, cachedAt: 0 });
}

export async function totalCachedBytes(): Promise<number> {
  const db = await getDb();
  const all = await db.getAll("texts");
  return all.reduce((sum, t) => sum + t.bytes, 0);
}

/** Evict least-recently-used texts until total size is ≤ cap. */
export async function evictLRU(capBytes: number): Promise<string[]> {
  const db = await getDb();
  const all = await db.getAll("texts");
  all.sort((a, b) => a.lastAccessed - b.lastAccessed);
  let total = all.reduce((s, t) => s + t.bytes, 0);
  const evicted: string[] = [];
  for (const t of all) {
    if (total <= capBytes) break;
    await db.delete("texts", t.textId);
    evicted.push(t.textId);
    total -= t.bytes;
  }
  return evicted;
}

// ──────────────── saved (收藏) ────────────────

export async function getSaved(): Promise<SavedEntry[]> {
  const db = await getDb();
  const all = await db.getAll("saved");
  return all.sort((a, b) => b.savedAt - a.savedAt);
}

export async function isSaved(textId: string): Promise<boolean> {
  const db = await getDb();
  return (await db.get("saved", textId)) !== undefined;
}

export async function toggleSaved(textId: string): Promise<boolean> {
  const db = await getDb();
  const existing = await db.get("saved", textId);
  if (existing) {
    await db.delete("saved", textId);
    return false;
  }
  await db.put("saved", { textId, savedAt: Date.now() });
  return true;
}

export async function putSaved(entry: SavedEntry): Promise<void> {
  const db = await getDb();
  await db.put("saved", entry);
}

export async function removeSaved(textId: string): Promise<void> {
  const db = await getDb();
  await db.delete("saved", textId);
}

// ──────────────── bookmarks (標記) ────────────────

export async function getBookmarks(textId?: string): Promise<Bookmark[]> {
  const db = await getDb();
  const all = await db.getAll("bookmarks");
  const filtered = textId ? all.filter((b) => b.textId === textId) : all;
  return filtered
    .map((item) => {
      const { key, ...rest } = item;
      void key;
      return rest;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function addBookmark(b: Omit<Bookmark, "createdAt"> & { createdAt?: number }): Promise<Bookmark> {
  const db = await getDb();
  const full: Bookmark = { ...b, createdAt: b.createdAt ?? Date.now() };
  await db.put("bookmarks", { ...full, key: bookmarkKey(full) });
  return full;
}

export async function removeBookmark(textId: string, lb: string): Promise<void> {
  const db = await getDb();
  await db.delete("bookmarks", bookmarkKey({ textId, lb }));
}

// ──────────────── recents ────────────────

export async function getRecents(): Promise<RecentEntry[]> {
  const db = await getDb();
  const all = await db.getAll("recents");
  return all.sort((a, b) => b.openedAt - a.openedAt).slice(0, RECENTS_LIMIT);
}

export async function recordRecent(entry: RecentEntry): Promise<void> {
  const db = await getDb();
  await db.put("recents", entry);
  const all = await db.getAll("recents");
  if (all.length > RECENTS_LIMIT) {
    const sorted = all.sort((a, b) => a.openedAt - b.openedAt);
    const overflow = sorted.length - RECENTS_LIMIT;
    for (let i = 0; i < overflow; i++) {
      await db.delete("recents", sorted[i].textId);
    }
  }
}

export async function removeRecent(textId: string): Promise<void> {
  const db = await getDb();
  await db.delete("recents", textId);
}

// ──────────────── settings ────────────────

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const s = (await db.get("settings", "current")) as Settings | undefined;
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export async function putSettings(s: Settings): Promise<void> {
  const db = await getDb();
  await db.put("settings", s, "current");
}

export async function patchSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await putSettings(next);
  return next;
}

// ──────────────── wipe / export helpers ────────────────

export type ClearScope = "cache" | "saves" | "everything";

export async function clearScope(scope: ClearScope): Promise<void> {
  const db = await getDb();
  if (scope === "cache" || scope === "everything") {
    await db.clear("texts");
  }
  if (scope === "saves" || scope === "everything") {
    await db.clear("saved");
    await db.clear("bookmarks");
  }
  if (scope === "everything") {
    await db.clear("recents");
    await db.clear("settings");
  }
}

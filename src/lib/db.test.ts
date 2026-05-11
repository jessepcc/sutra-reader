import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  _resetDbForTests,
  addBookmark,
  clearScope,
  evictLRU,
  getBookmarks,
  getRecents,
  getSaved,
  getSettings,
  getStoredText,
  isSaved,
  patchSettings,
  putStoredText,
  recordRecent,
  removeBookmark,
  removeSaved,
  RECENTS_LIMIT,
  toggleSaved,
  totalCachedBytes,
  touchStoredText,
} from "./db";

beforeEach(() => {
  // fresh in-memory IndexedDB per test
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe("texts (LRU cache)", () => {
  it("put / get / touch / totalBytes round-trips", async () => {
    await putStoredText({
      textId: "T01",
      sha: "a",
      xml: "<x/>",
      htmlFragments: ["<p/>"],
      lastAccessed: 1,
      bytes: 100,
    });
    const got = await getStoredText("T01");
    expect(got?.htmlFragments).toEqual(["<p/>"]);
    expect(await totalCachedBytes()).toBe(100);
    await touchStoredText("T01", 2);
    const after = await getStoredText("T01");
    expect(after?.lastAccessed).toBe(2);
  });

  it("touchStoredText is a no-op if the text is missing", async () => {
    await touchStoredText("missing");
    expect(await getStoredText("missing")).toBeUndefined();
  });

  it("evicts least-recently-used texts to fit under cap", async () => {
    await putStoredText({ textId: "a", sha: "x", xml: "", htmlFragments: [], lastAccessed: 1, bytes: 50 });
    await putStoredText({ textId: "b", sha: "x", xml: "", htmlFragments: [], lastAccessed: 2, bytes: 50 });
    await putStoredText({ textId: "c", sha: "x", xml: "", htmlFragments: [], lastAccessed: 3, bytes: 50 });

    const evicted = await evictLRU(100); // keep newest two (b, c)
    expect(evicted).toEqual(["a"]);
    expect(await getStoredText("a")).toBeUndefined();
    expect(await getStoredText("b")).toBeDefined();
    expect(await getStoredText("c")).toBeDefined();
  });

  it("evictLRU is a no-op when total ≤ cap", async () => {
    await putStoredText({ textId: "a", sha: "x", xml: "", htmlFragments: [], lastAccessed: 1, bytes: 10 });
    expect(await evictLRU(1000)).toEqual([]);
  });
});

describe("saved (收藏)", () => {
  it("toggle adds then removes", async () => {
    expect(await isSaved("T01")).toBe(false);
    expect(await toggleSaved("T01")).toBe(true);
    expect(await isSaved("T01")).toBe(true);
    expect(await toggleSaved("T01")).toBe(false);
    expect(await isSaved("T01")).toBe(false);
  });

  it("getSaved returns newest first", async () => {
    await toggleSaved("a"); // older
    await new Promise((r) => setTimeout(r, 2));
    await toggleSaved("b"); // newer
    const list = await getSaved();
    expect(list.map((s) => s.textId)).toEqual(["b", "a"]);
  });

  it("removeSaved is idempotent on missing", async () => {
    await removeSaved("nope"); // does not throw
  });
});

describe("bookmarks (標記)", () => {
  it("add / list / remove", async () => {
    await addBookmark({ textId: "T01", lb: "001a05", label: "卷一 始" });
    await addBookmark({ textId: "T01", lb: "001b10", label: "卷一 中" });
    await addBookmark({ textId: "T02", lb: "002a01", label: "卷二" });

    expect(await getBookmarks("T01")).toHaveLength(2);
    expect(await getBookmarks()).toHaveLength(3);

    await removeBookmark("T01", "001a05");
    expect(await getBookmarks("T01")).toHaveLength(1);
  });

  it("upserts on the same {textId, lb}", async () => {
    await addBookmark({ textId: "T01", lb: "x", label: "first" });
    await addBookmark({ textId: "T01", lb: "x", label: "second" });
    const list = await getBookmarks("T01");
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe("second");
  });
});

describe("recents", () => {
  it("records and returns newest first", async () => {
    await recordRecent({ textId: "a", openedAt: 1 });
    await recordRecent({ textId: "b", openedAt: 2 });
    const r = await getRecents();
    expect(r.map((e) => e.textId)).toEqual(["b", "a"]);
  });

  it("caps the store at RECENTS_LIMIT", async () => {
    for (let i = 0; i < RECENTS_LIMIT + 5; i++) {
      await recordRecent({ textId: `t${i}`, openedAt: i });
    }
    const r = await getRecents();
    expect(r).toHaveLength(RECENTS_LIMIT);
    expect(r[0].textId).toBe(`t${RECENTS_LIMIT + 4}`); // newest
  });
});

describe("settings", () => {
  it("returns defaults when nothing stored", async () => {
    const s = await getSettings();
    expect(s.direction).toBe("vertical-rl");
    expect(s.fontScale).toBe(1);
  });

  it("patch merges and persists", async () => {
    const next = await patchSettings({ paperMode: "ink", fontScale: 1.2 });
    expect(next.paperMode).toBe("ink");
    expect(next.fontScale).toBe(1.2);
    const read = await getSettings();
    expect(read.paperMode).toBe("ink");
    expect(read.direction).toBe("vertical-rl"); // unchanged
  });
});

describe("clearScope", () => {
  beforeEach(async () => {
    await putStoredText({ textId: "x", sha: "1", xml: "", htmlFragments: [], lastAccessed: 1, bytes: 10 });
    await toggleSaved("x");
    await addBookmark({ textId: "x", lb: "a", label: "" });
    await recordRecent({ textId: "x", openedAt: 1 });
    await patchSettings({ paperMode: "ink" });
  });

  it("'cache' wipes texts only", async () => {
    await clearScope("cache");
    expect(await getStoredText("x")).toBeUndefined();
    expect(await isSaved("x")).toBe(true);
    expect((await getRecents()).length).toBe(1);
  });

  it("'saves' wipes saved + bookmarks", async () => {
    await clearScope("saves");
    expect(await isSaved("x")).toBe(false);
    expect(await getBookmarks()).toEqual([]);
    expect(await getStoredText("x")).toBeDefined();
  });

  it("'everything' nukes all stores", async () => {
    await clearScope("everything");
    expect(await getStoredText("x")).toBeUndefined();
    expect(await isSaved("x")).toBe(false);
    expect(await getBookmarks()).toEqual([]);
    expect(await getRecents()).toEqual([]);
    // settings revert to defaults
    expect((await getSettings()).paperMode).toBe("paper");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  _resetDbForTests,
  addBookmark,
  getBookmarks,
  getSaved,
  getSettings,
  patchSettings,
  recordRecent,
  toggleSaved,
} from "./db";
import {
  buildExport,
  bundleToJson,
  importBundle,
  mergeBundles,
  parseBundle,
  validateBundle,
} from "./backup";
import { DEFAULT_SETTINGS, type ExportBundle } from "./types";

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
  _resetDbForTests();
});

function emptyBundle(savedAt = "2026-01-01T00:00:00Z"): ExportBundle {
  return {
    version: 1,
    savedAt,
    saved: [],
    bookmarks: [],
    recents: [],
    settings: DEFAULT_SETTINGS,
  };
}

describe("validateBundle", () => {
  it("accepts a well-formed bundle", () => {
    expect(validateBundle(emptyBundle())).toBe(true);
  });

  it.each([
    null,
    undefined,
    {},
    { version: 0, saved: [], bookmarks: [], recents: [], settings: {} },
    { version: 1, saved: "no", bookmarks: [], recents: [], settings: {} },
    { version: 1, saved: [], bookmarks: [], recents: [] }, // missing settings
  ])("rejects malformed: %p", (input) => {
    expect(validateBundle(input)).toBe(false);
  });
});

describe("mergeBundles", () => {
  it("last-write-wins on saved entries", () => {
    const a: ExportBundle = {
      ...emptyBundle("2026-01-01T00:00:00Z"),
      saved: [{ textId: "T01", savedAt: 100 }],
    };
    const b: ExportBundle = {
      ...emptyBundle("2026-02-01T00:00:00Z"),
      saved: [{ textId: "T01", savedAt: 200 }],
    };
    expect(mergeBundles(a, b).saved[0].savedAt).toBe(200);
    expect(mergeBundles(b, a).saved[0].savedAt).toBe(200);
  });

  it("unions bookmarks by {textId, lb} with newest createdAt winning", () => {
    const a: ExportBundle = {
      ...emptyBundle("2026-01-01T00:00:00Z"),
      bookmarks: [{ textId: "T01", lb: "001a05", label: "old", createdAt: 100 }],
    };
    const b: ExportBundle = {
      ...emptyBundle("2026-02-01T00:00:00Z"),
      bookmarks: [
        { textId: "T01", lb: "001a05", label: "new", createdAt: 200 },
        { textId: "T01", lb: "002a01", label: "another", createdAt: 150 },
      ],
    };
    const merged = mergeBundles(a, b);
    expect(merged.bookmarks).toHaveLength(2);
    const first = merged.bookmarks.find((x) => x.lb === "001a05");
    expect(first?.label).toBe("new");
  });

  it("picks settings from the bundle with the newer savedAt", () => {
    const a: ExportBundle = {
      ...emptyBundle("2026-01-01T00:00:00Z"),
      settings: { ...DEFAULT_SETTINGS, paperMode: "ink" },
    };
    const b: ExportBundle = {
      ...emptyBundle("2026-02-01T00:00:00Z"),
      settings: { ...DEFAULT_SETTINGS, paperMode: "ash" },
    };
    expect(mergeBundles(a, b).settings.paperMode).toBe("ash");
    expect(mergeBundles(b, a).settings.paperMode).toBe("ash");
  });

  it("falls back gracefully when savedAt is malformed", () => {
    const a: ExportBundle = {
      ...emptyBundle("not-a-date"),
      settings: { ...DEFAULT_SETTINGS, paperMode: "ink" },
    };
    const b: ExportBundle = {
      ...emptyBundle("2026-02-01T00:00:00Z"),
      settings: { ...DEFAULT_SETTINGS, paperMode: "ash" },
    };
    // a's date is bad → b wins
    expect(mergeBundles(a, b).settings.paperMode).toBe("ash");
    // both bad → still doesn't throw
    expect(() =>
      mergeBundles(a, { ...a, savedAt: "also-bad" }),
    ).not.toThrow();
  });
});

describe("buildExport / importBundle round-trip", () => {
  it("captures current store state into a bundle", async () => {
    await toggleSaved("T01");
    await addBookmark({ textId: "T01", lb: "001a05", label: "Hello" });
    await recordRecent({ textId: "T01", openedAt: 1234 });
    await patchSettings({ paperMode: "ink" });

    const bundle = await buildExport();
    expect(bundle.version).toBe(1);
    expect(bundle.saved.map((s) => s.textId)).toEqual(["T01"]);
    expect(bundle.bookmarks).toHaveLength(1);
    expect(bundle.recents).toHaveLength(1);
    expect(bundle.settings.paperMode).toBe("ink");
  });

  it("import merges into an empty store", async () => {
    // Use a far-future timestamp so the incoming bundle always wins over
    // whatever Date.now() the test runner reports.
    const bundle: ExportBundle = {
      ...emptyBundle("2999-01-01T00:00:00Z"),
      saved: [{ textId: "T01", savedAt: 1 }, { textId: "T02", savedAt: 2 }],
      bookmarks: [{ textId: "T01", lb: "001a05", label: "x", createdAt: 1 }],
      recents: [{ textId: "T01", openedAt: 10 }],
      settings: { ...DEFAULT_SETTINGS, paperMode: "ash", fontScale: 1.4 },
    };
    await importBundle(bundle);
    expect((await getSaved()).map((s) => s.textId).sort()).toEqual(["T01", "T02"]);
    expect(await getBookmarks()).toHaveLength(1);
    expect((await getSettings()).paperMode).toBe("ash");
  });

  it("import rejects malformed payloads", async () => {
    await expect(importBundle({ wrong: true })).rejects.toThrow(/Invalid backup/);
  });

  it("import preserves current state when the incoming bundle is older", async () => {
    await toggleSaved("T01");
    const olderBundle: ExportBundle = {
      ...emptyBundle("2020-01-01T00:00:00Z"),
      saved: [],
      settings: { ...DEFAULT_SETTINGS, paperMode: "ink" }, // older — should lose
    };
    const merged = await importBundle(olderBundle);
    expect(merged.saved.map((s) => s.textId)).toEqual(["T01"]);
  });
});

describe("bundleToJson / parseBundle", () => {
  it("round-trips", () => {
    const b = emptyBundle();
    const json = bundleToJson(b);
    const parsed = parseBundle(json);
    expect(parsed).toEqual(b);
  });

  it("rejects non-JSON", () => {
    expect(() => parseBundle("not json")).toThrow(/Invalid backup/);
  });

  it("rejects schema-mismatched JSON", () => {
    expect(() => parseBundle(JSON.stringify({ version: 2 }))).toThrow(/schema/);
  });

  it("pretty=false produces compact output", () => {
    const compact = bundleToJson(emptyBundle(), false);
    expect(compact).not.toMatch(/\n/);
  });
});

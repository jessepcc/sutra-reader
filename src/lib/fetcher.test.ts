import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { _resetDbForTests, getStoredText, putStoredText } from "./db";
import { loadText } from "./fetcher";
import type { TextEntry } from "./types";

const SAMPLE_XML = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><div type="juan" n="1"><head>測試</head><p>內容</p></div></body></text></TEI>`;

const entry: TextEntry = {
  canon: "T",
  volume: "T01",
  id: "T01n0001_001",
  title: "長阿含經",
  path: "T/T01/T01n0001_001.xml",
  sha: "deadbeef",
};

function mockFetch(body: string, ok = true): typeof fetch {
  return vi
    .fn()
    .mockImplementation(async () => new Response(body, { status: ok ? 200 : 500 })) as unknown as typeof fetch;
}

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe("loadText", () => {
  it("fetches from network on first load and caches the result", async () => {
    const fetcher = mockFetch(SAMPLE_XML);
    const result = await loadText(entry, { fetcher });
    expect(result.fromCache).toBe(false);
    expect(result.stale).toBe(false);
    expect(result.rendered.juans).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/cbeta-org/xml-p5/deadbeef/T/T01/T01n0001_001.xml",
    );
    const cached = await getStoredText(entry.id);
    expect(cached?.xml).toBe(SAMPLE_XML);
  });

  it("returns the cached copy when sha matches", async () => {
    const fetcher = mockFetch(SAMPLE_XML);
    await loadText(entry, { fetcher });
    const second = await loadText(entry, { fetcher });
    expect(second.fromCache).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("re-fetches when the cached sha doesn't match (stale)", async () => {
    await putStoredText({
      textId: entry.id,
      sha: "OLD-SHA",
      xml: "<TEI/>",
      htmlFragments: [],
      lastAccessed: 1,
      bytes: 10,
    });
    const fetcher = mockFetch(SAMPLE_XML);
    const result = await loadText(entry, { fetcher });
    expect(result.fromCache).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("honors forceNetwork", async () => {
    const fetcher = mockFetch(SAMPLE_XML);
    await loadText(entry, { fetcher });
    await loadText(entry, { fetcher, forceNetwork: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("throws a meaningful error on network failure", async () => {
    const fetcher = mockFetch("oops", false);
    await expect(loadText(entry, { fetcher })).rejects.toThrow(/Failed to fetch/);
  });

  it("serves stale cached XML when refresh fails", async () => {
    await putStoredText({
      textId: entry.id,
      path: entry.path,
      sha: "OLD-SHA",
      xml: SAMPLE_XML,
      htmlFragments: [],
      lastAccessed: 1,
      bytes: 10,
      staleSha: entry.sha,
    });
    const fetcher = mockFetch("offline", false);
    const result = await loadText(entry, { fetcher });
    expect(result.fromCache).toBe(true);
    expect(result.stale).toBe(true);
    expect(result.xml).toBe(SAMPLE_XML);
  });

  it("refreshes stale cached XML from the manifest commit", async () => {
    await putStoredText({
      textId: entry.id,
      path: entry.path,
      sha: entry.sha,
      sourceSha: "old-commit",
      xml: "<TEI/>",
      htmlFragments: [],
      lastAccessed: 1,
      bytes: 10,
      staleSha: "new-blob",
      staleSourceSha: "new-commit",
      staleBytes: 99,
    });
    const fetcher = mockFetch(SAMPLE_XML);
    const result = await loadText(entry, { fetcher });
    expect(result.fromCache).toBe(false);
    expect(fetcher).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/cbeta-org/xml-p5/new-commit/T/T01/T01n0001_001.xml",
    );
    const cached = await getStoredText(entry.id);
    expect(cached?.sha).toBe("new-blob");
    expect(cached?.sourceSha).toBe("new-commit");
    expect(cached?.staleSha).toBeUndefined();
  });

  it("evicts to honor the cache cap after writing", async () => {
    // pre-populate with two large, older texts
    await putStoredText({
      textId: "old-a",
      sha: "x",
      xml: "",
      htmlFragments: [],
      lastAccessed: 1,
      bytes: 1000,
    });
    await putStoredText({
      textId: "old-b",
      sha: "x",
      xml: "",
      htmlFragments: [],
      lastAccessed: 2,
      bytes: 1000,
    });
    const fetcher = mockFetch(SAMPLE_XML);
    await loadText(entry, { fetcher, cacheCapBytes: SAMPLE_XML.length + 10 });
    expect(await getStoredText("old-a")).toBeUndefined();
    expect(await getStoredText("old-b")).toBeUndefined();
    expect(await getStoredText(entry.id)).toBeDefined();
  });
});

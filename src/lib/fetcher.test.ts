import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { _resetDbForTests, getStoredText, putStoredText } from "./db";
import { CACHE_TTL_MS, loadText } from "./fetcher";
import type { TextEntry } from "./types";

// Sample HTML that the CBETA API would return for one juan.
const SAMPLE_JUAN_HTML = `<html><head></head><body><div id='body'><span class="lb" id="T08n0251_p0848a01">T08n0251_p0848a01</span><p class="p">內容</p></div></body></html>`;

const SAMPLE_RESPONSE = JSON.stringify({
  num_found: 1,
  results: [SAMPLE_JUAN_HTML],
  work_info: {
    work: "T0251",
    title: "般若波羅蜜多心經",
    juan: 1,
    juan_list: "1",
    canon: "T",
  },
});

const entry: TextEntry = {
  canon: "T",
  volume: "T08",
  id: "T08n0251",
  title: "般若波羅蜜多心經",
  path: "T/T08/T08n0251.xml",
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
  it("fetches from API on first load and caches the result", async () => {
    const fetcher = mockFetch(SAMPLE_RESPONSE);
    const result = await loadText(entry, { fetcher });
    expect(result.fromCache).toBe(false);
    expect(result.stale).toBe(false);
    expect(result.rendered.juans).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/api/cbeta/juans"),
    );
    const cached = await getStoredText(entry.id);
    expect(cached?.workId).toBe("T0251");
    expect(cached?.htmlFragments).toHaveLength(1);
  });

  it("returns the cached copy when within TTL", async () => {
    const fetcher = mockFetch(SAMPLE_RESPONSE);
    await loadText(entry, { fetcher });
    const second = await loadText(entry, { fetcher });
    expect(second.fromCache).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("re-fetches when the cached entry is expired (cachedAt=0)", async () => {
    await putStoredText({
      textId: entry.id,
      workId: "T0251",
      title: "舊版",
      juanCount: 1,
      htmlFragments: ["<p>old</p>"],
      cachedAt: 0,
      lastAccessed: 1,
      bytes: 10,
    });
    const fetcher = mockFetch(SAMPLE_RESPONSE);
    const result = await loadText(entry, { fetcher });
    expect(result.fromCache).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("re-fetches when the cached entry has exceeded TTL", async () => {
    await putStoredText({
      textId: entry.id,
      workId: "T0251",
      title: "舊版",
      juanCount: 1,
      htmlFragments: ["<p>old</p>"],
      cachedAt: Date.now() - CACHE_TTL_MS - 1,
      lastAccessed: 1,
      bytes: 10,
    });
    const fetcher = mockFetch(SAMPLE_RESPONSE);
    const result = await loadText(entry, { fetcher });
    expect(result.fromCache).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("honors forceNetwork", async () => {
    const fetcher = mockFetch(SAMPLE_RESPONSE);
    await loadText(entry, { fetcher });
    await loadText(entry, { fetcher, forceNetwork: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("throws a meaningful error on network failure with no cache", async () => {
    const fetcher = mockFetch("oops", false);
    await expect(loadText(entry, { fetcher })).rejects.toThrow(/CBETA API error/);
  });

  it("serves stale cached HTML when refresh fails", async () => {
    await putStoredText({
      textId: entry.id,
      workId: "T0251",
      title: "舊版",
      juanCount: 1,
      htmlFragments: ["<p>cached</p>"],
      cachedAt: 0,
      lastAccessed: 1,
      bytes: 10,
    });
    const fetcher = mockFetch("offline", false);
    const result = await loadText(entry, { fetcher });
    expect(result.fromCache).toBe(true);
    expect(result.stale).toBe(true);
    expect(result.rendered.juans[0].html).toBe("<p>cached</p>");
  });

  it("normalizes lb spans in API HTML", async () => {
    const fetcher = mockFetch(SAMPLE_RESPONSE);
    const result = await loadText(entry, { fetcher });
    const html = result.rendered.juans[0].html;
    expect(html).toContain('class="tei-lb"');
    expect(html).toContain('id="lb_0848a01"');
    expect(html).toContain('data-lb="0848a01"');
  });

  it("evicts to honor the cache cap after writing", async () => {
    await putStoredText({
      textId: "old-a",
      workId: "X0001",
      title: "old",
      juanCount: 1,
      htmlFragments: [""],
      cachedAt: 1,
      lastAccessed: 1,
      bytes: 1000,
    });
    await putStoredText({
      textId: "old-b",
      workId: "X0002",
      title: "old",
      juanCount: 1,
      htmlFragments: [""],
      cachedAt: 2,
      lastAccessed: 2,
      bytes: 1000,
    });
    const fetcher = mockFetch(SAMPLE_RESPONSE);
    await loadText(entry, { fetcher, cacheCapBytes: SAMPLE_RESPONSE.length + 10 });
    expect(await getStoredText("old-a")).toBeUndefined();
    expect(await getStoredText("old-b")).toBeUndefined();
    expect(await getStoredText(entry.id)).toBeDefined();
  });
});

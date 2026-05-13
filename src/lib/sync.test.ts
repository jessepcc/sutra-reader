import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { _resetDbForTests, putStoredText } from "./db";
import { CACHE_TTL_MS } from "./fetcher";
import { checkCachedTextUpdates } from "./sync";

function makeText(textId: string, cachedAt: number) {
  return putStoredText({
    textId,
    workId: "T0001",
    title: "test",
    juanCount: 1,
    htmlFragments: [],
    cachedAt,
    lastAccessed: Date.now(),
    bytes: 10,
  });
}

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe("checkCachedTextUpdates", () => {
  it("reports 0 expired when all texts are fresh", async () => {
    await makeText("fresh", Date.now());
    const result = await checkCachedTextUpdates();
    expect(result.expiredCount).toBe(0);
  });

  it("counts texts whose cachedAt has exceeded TTL", async () => {
    await makeText("fresh", Date.now());
    await makeText("stale", Date.now() - CACHE_TTL_MS - 1);
    const result = await checkCachedTextUpdates();
    expect(result.expiredCount).toBe(1);
  });

  it("counts texts with cachedAt=0 (force-expired)", async () => {
    await makeText("forced", 0);
    const result = await checkCachedTextUpdates();
    expect(result.expiredCount).toBe(1);
  });

  it("returns 0 when no texts are cached", async () => {
    const result = await checkCachedTextUpdates();
    expect(result.expiredCount).toBe(0);
  });
});

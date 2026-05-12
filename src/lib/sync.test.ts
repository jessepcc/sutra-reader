import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { _resetDbForTests, getStoredText, putStoredText } from "./db";
import { checkManifestUpdates } from "./sync";

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe("checkManifestUpdates", () => {
  it("marks cached texts stale when manifest SHA changes", async () => {
    await putStoredText({
      textId: "T01n0001",
      path: "T/T01/T01n0001.xml",
      sha: "old",
      xml: "",
      htmlFragments: [],
      lastAccessed: 1,
      bytes: 10,
    });

    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          generatedAt: "2026-01-01T00:00:00Z",
          upstreamSha: "commit",
          files: [{ path: "T/T01/T01n0001.xml", sha: "new", bytes: 100 }],
        }),
      ),
    ) as unknown as typeof fetch;

    const result = await checkManifestUpdates(fetcher);
    expect(result).toEqual({ upstreamSha: "commit", staleTextIds: ["T01n0001"] });
    const stored = await getStoredText("T01n0001");
    expect(stored?.staleSha).toBe("new");
    expect(stored?.staleSourceSha).toBe("commit");
    expect(stored?.staleBytes).toBe(100);
  });
});

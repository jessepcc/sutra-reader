import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, vi } from "vitest";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/catalog/index.json") {
      return jsonResponse(readPublicJson("catalog/index.json"));
    }
    const volumeMatch = url.pathname.match(/^\/catalog\/volumes\/([^/]+\.json)$/);
    if (volumeMatch) {
      return jsonResponse(readPublicJson(`catalog/volumes/${decodeURIComponent(volumeMatch[1])}`));
    }
    if (url.pathname === "/manifest.json") {
      return jsonResponse(readPublicJson("manifest.json"));
    }
    return originalFetch(input, init);
  }) as typeof fetch;
});

function readPublicJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), "public", relativePath), "utf8"));
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

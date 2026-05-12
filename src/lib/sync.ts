import { diffManifest } from "./catalog";
import { findTextById } from "./catalog-context";
import {
  getSaved,
  getStoredTexts,
  markStoredTextStale,
  patchSettings,
} from "./db";
import { loadText } from "./fetcher";
import type { Manifest } from "./types";

export interface UpdateCheckResult {
  upstreamSha: string;
  staleTextIds: string[];
}

export async function fetchManifest(fetcher: typeof fetch = fetch): Promise<Manifest> {
  const res = await fetcher(`${import.meta.env.BASE_URL}manifest.json`);
  if (!res.ok) {
    throw new Error(`更新清單不可用：${res.status} ${res.statusText}`);
  }
  return (await res.json()) as Manifest;
}

export async function checkManifestUpdates(fetcher: typeof fetch = fetch): Promise<UpdateCheckResult> {
  const manifest = await fetchManifest(fetcher);
  const cachedTexts = await getStoredTexts();
  const cachedCatalog = {
    upstreamSha: "",
    generatedAt: "",
    canons: [],
    volumes: [],
    texts: cachedTexts
      .filter((t) => t.path)
      .map((t) => ({
        canon: "",
        volume: "",
        id: t.textId,
        title: t.textId,
        path: t.path!,
        sha: t.sha,
        sourceSha: t.sourceSha,
        bytes: t.bytes,
      })),
  };
  const staleTextIds = diffManifest(cachedCatalog, manifest);
  const manifestByPath = new Map(manifest.files.map((f) => [f.path, f] as const));
  await Promise.all(
    cachedTexts.map(async (text) => {
      const nextFile = text.path ? manifestByPath.get(text.path) : undefined;
      if (nextFile && nextFile.sha !== text.sha) {
        await markStoredTextStale(
          text.textId,
          nextFile.sha,
          manifest.upstreamSha,
          nextFile.bytes,
        );
      }
    }),
  );
  return { upstreamSha: manifest.upstreamSha, staleTextIds };
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
      // Best-effort background cache; saved state should never depend on this.
    }
  }
  return count;
}

export async function applyAutoUpdateSetting(autoUpdate: boolean): Promise<void> {
  await patchSettings({ autoUpdate });
  if (autoUpdate) void precacheSavedTexts();
}

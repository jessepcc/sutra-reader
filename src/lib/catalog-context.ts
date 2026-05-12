// Async catalog access. The app shell imports only tiny loader code; generated
// catalog JSON lives in public/catalog/** so browse metadata downloads on demand.

import gaijiJson from "../data/gaiji.json";
import { filterGated } from "./catalog";
import type { CatalogIndex, TextEntry } from "./types";

export const GAIJI: Record<string, string> = gaijiJson as Record<string, string>;

let indexPromise: Promise<CatalogIndex> | null = null;
const volumePromises = new Map<string, Promise<TextEntry[]>>();

function appBase(): string {
  return import.meta.env.BASE_URL;
}

export function _resetCatalogForTests(): void {
  indexPromise = null;
  volumePromises.clear();
}

async function fetchJson<T>(path: string): Promise<T> {
  const relative = `${appBase()}${path.replace(/^\//, "")}`;
  const url =
    typeof window === "undefined"
      ? new URL(relative, "http://localhost").toString()
      : new URL(relative, window.location.origin).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export function loadCatalogIndex(): Promise<CatalogIndex> {
  if (!indexPromise) {
    indexPromise = fetchJson<CatalogIndex>("catalog/index.json").then(filterGated);
  }
  return indexPromise;
}

export async function loadVolumeTexts(canonId: string, volumeId: string): Promise<TextEntry[]> {
  const key = `${canonId}/${volumeId}`;
  if (!volumePromises.has(key)) {
    volumePromises.set(
      key,
      fetchJson<TextEntry[]>(`catalog/volumes/${encodeURIComponent(volumeId)}.json`).then(
        (texts) =>
          texts.filter((t) => t.canon === canonId && t.volume === volumeId),
      ),
    );
  }
  return volumePromises.get(key)!;
}

export async function findTextById(textId: string): Promise<TextEntry | undefined> {
  const index = await loadCatalogIndex();
  const volume = index.volumes.find((v) => textId.startsWith(v.id));
  if (volume) {
    const texts = await loadVolumeTexts(volume.canon, volume.id);
    const found = texts.find((t) => t.id === textId);
    if (found) return found;
  }

  // Fallback for non-prefix ids or unusual catalog rows. This is rare and only
  // runs after the direct volume guess misses.
  for (const v of index.volumes) {
    if (v.id === volume?.id) continue;
    const texts = await loadVolumeTexts(v.canon, v.id);
    const found = texts.find((t) => t.id === textId);
    if (found) return found;
  }
  return undefined;
}

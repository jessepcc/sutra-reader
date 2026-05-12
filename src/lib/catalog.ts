// Catalog helpers: filter gated canons, build raw GitHub URLs, derive volumes/canons.

import type { Canon, Catalog, CatalogIndex, ManifestFile, TextEntry, Volume } from "./types";

/**
 * Canons that v1 must exclude from browse (held by third parties under
 * non-CC licences — see SPEC.md §1).
 */
export const GATED_CANONS: ReadonlySet<string> = new Set([
  "LC", // 呂澂佛學著作集
]);

/**
 * Volume id prefixes that v1 must exclude (Yinshun / Taixu sub-collections
 * are held by the Yinshun Foundation).
 */
export const GATED_VOLUME_PREFIXES: readonly string[] = [
  "Y", // Yinshun
  "TX", // Taixu
];

export function isGatedCanon(canonId: string): boolean {
  return GATED_CANONS.has(canonId);
}

export function isGatedVolume(volumeId: string): boolean {
  return GATED_VOLUME_PREFIXES.some((p) => volumeId.startsWith(p));
}

/**
 * Map a textId to a gated canon/prefix if it belongs to one. The filtered
 * catalog drops these entries, so deep links into them lose their canon
 * context — we recover it from the id's prefix.
 */
export function gatedCanonForTextId(textId: string): string | undefined {
  for (const c of GATED_CANONS) {
    if (textId.startsWith(c)) return c;
  }
  for (const p of GATED_VOLUME_PREFIXES) {
    if (textId.startsWith(p)) return p;
  }
  return undefined;
}

/** Strip gated canons and volumes from a catalog. Pure / total. */
export function filterGated<T extends Catalog | CatalogIndex>(catalog: T): T {
  const canons = catalog.canons.filter((c) => !isGatedCanon(c.id));
  const allowedCanons = new Set(canons.map((c) => c.id));
  const volumes = catalog.volumes.filter(
    (v) => allowedCanons.has(v.canon) && !isGatedVolume(v.id),
  );
  if (!("texts" in catalog)) return { ...catalog, canons, volumes } as T;
  const allowedVolumes = new Set(volumes.map((v) => v.id));
  const texts = catalog.texts.filter(
    (t) => allowedCanons.has(t.canon) && allowedVolumes.has(t.volume),
  );
  return { ...catalog, canons, volumes, texts } as T;
}

/** Build the raw GitHub URL for a given text entry using a pinned commit SHA. */
export function rawGitHubUrl(text: TextEntry): string {
  const sourceSha = text.sourceSha ?? text.sha;
  return `https://raw.githubusercontent.com/cbeta-org/xml-p5/${sourceSha}/${text.path}`;
}

/** Group texts by canon then volume for browse-screen rendering. */
export function groupByCanon(catalog: Catalog): Map<Canon, Map<Volume, TextEntry[]>> {
  const out = new Map<Canon, Map<Volume, TextEntry[]>>();
  const canonsById = new Map(catalog.canons.map((c) => [c.id, c] as const));
  const volumesById = new Map(catalog.volumes.map((v) => [v.id, v] as const));

  for (const text of catalog.texts) {
    const canon = canonsById.get(text.canon);
    const volume = volumesById.get(text.volume);
    if (!canon || !volume) continue;
    let byVol = out.get(canon);
    if (!byVol) {
      byVol = new Map();
      out.set(canon, byVol);
    }
    let bucket = byVol.get(volume);
    if (!bucket) {
      bucket = [];
      byVol.set(volume, bucket);
    }
    bucket.push(text);
  }
  return out;
}

export function findText(catalog: Catalog, textId: string): TextEntry | undefined {
  return catalog.texts.find((t) => t.id === textId);
}

export function findCanon(catalog: Catalog, canonId: string): Canon | undefined {
  return catalog.canons.find((c) => c.id === canonId);
}

export function findVolume(catalog: Catalog, volumeId: string): Volume | undefined {
  return catalog.volumes.find((v) => v.id === volumeId);
}

/**
 * Diff catalog SHAs against a fresh manifest. Returns the text ids whose
 * upstream sha changed (i.e. need re-fetch).
 */
export function diffManifest(catalog: Catalog, manifest: { files: ManifestFile[] }): string[] {
  const shaByPath = new Map(manifest.files.map((f) => [f.path, f.sha] as const));
  const stale: string[] = [];
  for (const text of catalog.texts) {
    const upstream = shaByPath.get(text.path);
    if (upstream && upstream !== text.sha) stale.push(text.id);
  }
  return stale;
}

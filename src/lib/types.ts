// Shared type definitions for the sutra reader domain.

export type CanonId = string; // e.g. "T", "X", "J"

export interface Canon {
  id: CanonId;
  abbr: string;
  name: string;
  /** Short description in 繁體中文. */
  description?: string;
}

export interface Volume {
  canon: CanonId;
  id: string; // e.g. "T01"
  label: string; // e.g. "第一冊"
}

export interface TextEntry {
  canon: CanonId;
  volume: string; // volume id
  id: string; // text id, e.g. "T01n0001_001"
  title: string;
  /** Path inside the upstream xml-p5 repo. */
  path: string;
  /** Content/blob SHA for update detection and cache identity. */
  sha: string;
  /** Pinned upstream commit SHA used to fetch immutable raw XML. */
  sourceSha?: string;
  bytes?: number;
}

export interface Catalog {
  /** Upstream commit SHA the catalog was generated against. */
  upstreamSha: string;
  generatedAt: string;
  canons: Canon[];
  volumes: Volume[];
  texts: TextEntry[];
}

export interface CatalogIndex {
  /** Upstream commit SHA the catalog was generated against. */
  upstreamSha: string;
  generatedAt: string;
  canons: Canon[];
  volumes: Volume[];
}

export interface ManifestFile {
  path: string;
  sha: string;
  bytes?: number;
}

export interface Manifest {
  generatedAt: string;
  upstreamSha: string;
  files: ManifestFile[];
}

export interface StoredText {
  textId: string;
  path?: string;
  sha: string;
  sourceSha?: string;
  xml: string;
  /** Rendered HTML, possibly chunked by juan. */
  htmlFragments: string[];
  /** Last accessed timestamp (for LRU eviction). */
  lastAccessed: number;
  /** Raw byte count of the source XML. */
  bytes: number;
  /** Latest known upstream content SHA when this cached text is stale. */
  staleSha?: string;
  /** Upstream commit SHA that contains staleSha. */
  staleSourceSha?: string;
  /** Latest known upstream source byte count. */
  staleBytes?: number;
  staleAt?: number;
}

export interface SavedEntry {
  textId: string;
  savedAt: number;
  note?: string;
}

export interface Bookmark {
  textId: string;
  lb: string; // line marker, e.g. "001a05"
  label: string;
  createdAt: number;
}

export interface RecentEntry {
  textId: string;
  openedAt: number;
  lastLb?: string;
}

export type PaperMode = "paper" | "ink" | "ash"; // 紙 / 墨 / 灰
export type ReadingDirection = "vertical-rl" | "horizontal-lr";

export interface Settings {
  direction: ReadingDirection;
  paperMode: PaperMode;
  fontScale: number; // 0.8 – 1.6, 1.0 default
  lineHeight: number; // 1.4 – 2.4
  autoUpdate: boolean;
  dyslexiaFont: boolean;
  cacheCapBytes: number; // LRU cap, default 200 MB
}

export const DEFAULT_SETTINGS: Settings = {
  direction: "vertical-rl",
  paperMode: "paper",
  fontScale: 1,
  lineHeight: 1.8,
  autoUpdate: false,
  dyslexiaFont: false,
  cacheCapBytes: 200 * 1024 * 1024,
};

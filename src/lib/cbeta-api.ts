// Typed client for the CBETA official REST API.
// Calls go through a same-origin Pages Function (functions/api/cbeta/[[path]].ts)
// which proxies https://cbdata.dila.edu.tw/stable — CBETA's API only emits
// Access-Control-Allow-Origin for Origin: https://cbeta.org, so direct
// browser calls are not possible. In dev, vite.config.ts proxies the same
// path to the upstream.
export const CBETA_BASE = "/api/cbeta";

// Maximum concurrent API requests (DILA asks for rate-limiting).
const MAX_CONCURRENT = 5;

/**
 * Derive the CBETA API work ID from a catalog text ID.
 * e.g. "T08n0251" → "T0251", "T01n0001_001" → "T0001"
 */
export function textIdToWorkId(textId: string): string {
  return textId
    .replace(/_\d+$/, "")      // strip optional _juan suffix
    .replace(/^([A-Z]+)\d+n/, "$1"); // strip volume digits + "n"
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface WorkInfo {
  work: string;
  title: string;
  juan: number;
  juan_list: string; // comma-separated, e.g. "1,2,3"
  canon: string;
  category?: string;
  byline?: string;
  creators?: string;
  time_dynasty?: string;
  time_from?: number;
  time_to?: number;
}

export interface JuanResponse {
  num_found: number;
  results: string[]; // full HTML document per juan
  work_info: WorkInfo;
}

export interface TocNode {
  title: string;
  file: string;
  juan: number;
  lb: string;
  type?: string;
  n?: string;
  isFolder?: boolean;
  children?: TocNode[];
}

export interface TocSearchResult {
  work: string;
  title: string;
  n: string;
  category?: string;
}

export interface FullTextResult {
  num_found: number;
  total_term_hits: number;
  results: Array<{
    juan: number;
    work: string;
    title: string;
    canon: string;
    vol: string;
    category?: string;
    term_hits: number;
    time_from?: number;
    time_to?: number;
  }>;
}

// ── Concurrency pool ───────────────────────────────────────────────────────

async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ── API calls ──────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const res = await fetcher(`${CBETA_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`CBETA API error ${res.status} for ${path}`);
  }
  return (await res.json()) as T;
}

/** Fetch one juan's HTML + work_info. */
export async function fetchJuan(
  workId: string,
  juan: number,
  fetcher: typeof fetch = fetch,
): Promise<JuanResponse> {
  return apiFetch<JuanResponse>(
    `/juans?edition=CBETA&work_info=1&work=${encodeURIComponent(workId)}&juan=${juan}`,
    fetcher,
  );
}

/** Fetch all juans for a work in parallel (rate-limited). Returns ordered HTML strings. */
export async function fetchAllJuans(
  workId: string,
  fetcher: typeof fetch = fetch,
): Promise<{ htmlFragments: string[]; workInfo: WorkInfo }> {
  // Fetch juan 1 first to discover the full juan_list.
  const first = await fetchJuan(workId, 1, fetcher);
  const juanList = first.work_info.juan_list
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  const htmlFragments: string[] = new Array(juanList.length);
  htmlFragments[0] = extractAndNormalizeHtml(first.results[0]);

  if (juanList.length > 1) {
    const remaining = juanList.slice(1);
    const tasks = remaining.map((n) => () =>
      fetchJuan(workId, n, fetcher).then((r) => extractAndNormalizeHtml(r.results[0])),
    );
    const rest = await withConcurrency(tasks, MAX_CONCURRENT);
    for (let i = 0; i < rest.length; i++) {
      htmlFragments[i + 1] = rest[i];
    }
  }

  return { htmlFragments, workInfo: first.work_info };
}

/**
 * Extract the body content from the full HTML document the API returns,
 * then normalize CBETA lb spans into the app's tei-lb anchor format so
 * bookmarks and deep-links (#lb_xxx) keep working.
 */
export function extractAndNormalizeHtml(fullHtml: string): string {
  // Extract <body> content
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch ? bodyMatch[1] : fullHtml;

  // Normalize lb spans:
  //   <span class="lb" id="T08n0251_p0848a01">T08n0251_p0848a01</span>
  //   → <a class="tei-lb" id="lb_0848a01" href="#lb_0848a01" data-lb="0848a01" aria-label="行 0848a01">※</a>
  body = body.replace(
    /<span class="lb" id="[^_"]+_p([^"]+)">[^<]*<\/span>/g,
    (_, lbVal) =>
      `<a class="tei-lb" id="lb_${lbVal}" href="#lb_${lbVal}" data-lb="${lbVal}" aria-label="行 ${lbVal}">※</a>`,
  );

  return body;
}

/** Title search across the CBETA catalog. */
export async function searchToc(
  q: string,
  fetcher: typeof fetch = fetch,
): Promise<TocSearchResult[]> {
  const data = await apiFetch<{ results: TocSearchResult[] }>(
    `/search/toc?q=${encodeURIComponent(q)}`,
    fetcher,
  );
  return data.results ?? [];
}

/** Full-text search. */
export async function searchFullText(
  q: string,
  start = 0,
  rows = 20,
  fetcher: typeof fetch = fetch,
): Promise<FullTextResult> {
  return apiFetch<FullTextResult>(
    `/search?q=${encodeURIComponent(q)}&start=${start}&rows=${rows}`,
    fetcher,
  );
}

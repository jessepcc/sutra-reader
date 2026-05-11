// Tiny utilities for deep-link parsing/formatting (/read/T01n0001#lb_001a05).
// Kept separate from React Router internals so it can be unit-tested.

export interface DeepLink {
  textId: string;
  lb?: string;
}

const HASH_LB_RE = /^lb_(.+)$/;

export function parseDeepLink(pathname: string, hash: string): DeepLink | null {
  const m = pathname.match(/^\/read\/([^/]+)\/?$/);
  if (!m) return null;
  const textId = decodeURIComponent(m[1]);
  const cleanedHash = hash.replace(/^#/, "");
  const lbMatch = cleanedHash.match(HASH_LB_RE);
  return { textId, lb: lbMatch?.[1] };
}

export function formatDeepLink(d: DeepLink): string {
  const base = `/read/${encodeURIComponent(d.textId)}`;
  return d.lb ? `${base}#lb_${d.lb}` : base;
}

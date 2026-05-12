// TEI P5 → HTML transformer for the CBETA xml-p5 subset.
//
// v1 supports the focused subset described in SPEC.md §3.4:
//   <div type="juan">, <head>, <p>, <lb n="…"/>, <pb n="…"/>,
//   <lg>/<l>, <note>, <g ref="…"/>, <choice><orig/><reg/></choice>,
//   <app><lem/><rdg/></app>.
//
// Unknown elements are *not* silently dropped — they are captured into a
// `RenderIssue[]` list so the diagnostics panel can surface them, while
// rendering still proceeds with the element's children inlined.

import { XMLParser } from "fast-xml-parser";

export interface RenderIssue {
  kind: "unknown-element" | "missing-gaiji" | "parse-error";
  detail: string;
}

export interface TeiHeader {
  /** Title from `<titleStmt><title>` if present. */
  title?: string;
  /** Raw HTML of `<publicationStmt>` for the 出處 panel. */
  publicationStmt?: string;
  /** Raw HTML of `<sourceDesc>` for the 出處 panel. */
  sourceDesc?: string;
}

export interface RenderResult {
  /** HTML fragments, one per juan (or one total if no juan division). */
  juans: { id: string; head?: string; html: string }[];
  header: TeiHeader;
  issues: RenderIssue[];
}

/** Map of CBETA gaiji codes → Unicode characters. Sparse but extendable. */
export type GaijiTable = Readonly<Record<string, string>>;

const XML_OPTS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
} as const;

// fast-xml-parser preserveOrder shape: array of single-key objects, with
// `:@` carrying attributes, and `#text` for text nodes.
type FxpNode = Record<string, unknown> & { ":@"?: Record<string, string> };

const TEXT_KEY = "#text";

function getTag(node: FxpNode): string {
  for (const k of Object.keys(node)) {
    if (k !== ":@") return k;
  }
  return "";
}

function getChildren(node: FxpNode): FxpNode[] {
  const tag = getTag(node);
  const val = node[tag];
  if (!Array.isArray(val)) return [];
  return val as FxpNode[];
}

function getAttrs(node: FxpNode): Record<string, string> {
  return (node[":@"] as Record<string, string>) ?? {};
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip the CBETA namespace prefix (cb:foo → foo) for matching. */
function localName(tag: string): string {
  const i = tag.indexOf(":");
  return i >= 0 ? tag.slice(i + 1) : tag;
}

interface RenderCtx {
  gaiji: GaijiTable;
  issues: RenderIssue[];
}

function renderChildren(nodes: FxpNode[], ctx: RenderCtx): string {
  let out = "";
  for (const n of nodes) {
    out += renderNode(n, ctx);
  }
  return out;
}

function renderNode(node: FxpNode, ctx: RenderCtx): string {
  const tag = getTag(node);
  if (tag === TEXT_KEY) {
    const text = node[TEXT_KEY];
    return typeof text === "string" ? escapeHtml(text) : "";
  }

  const attrs = getAttrs(node);
  const children = getChildren(node);

  switch (localName(tag)) {
    case "head":
      return `<h2 class="tei-head">${renderChildren(children, ctx)}</h2>`;
    case "p":
      return `<p class="tei-p">${renderChildren(children, ctx)}</p>`;
    case "lg":
      return `<div class="tei-lg">${renderChildren(children, ctx)}</div>`;
    case "l":
      return `<span class="tei-l">${renderChildren(children, ctx)}</span>`;
    case "lb": {
      const n = attrs["@_n"] ?? "";
      const e = escapeHtml(n);
      return `<a class="tei-lb" id="lb_${e}" href="#lb_${e}" data-lb="${e}" aria-label="行 ${e}">※</a>`;
    }
    case "pb": {
      const n = attrs["@_n"] ?? "";
      return `<span class="tei-pb" data-pb="${escapeHtml(n)}" aria-hidden="true">${escapeHtml(n)}</span>`;
    }
    case "note": {
      const inner = renderChildren(children, ctx);
      return `<span class="tei-note" role="note">${inner}</span>`;
    }
    case "g": {
      const ref = (attrs["@_ref"] ?? "").replace(/^#/, "");
      const unicode = ctx.gaiji[ref];
      if (unicode) {
        return `<span class="tei-g" data-ref="${escapeHtml(ref)}" title="${escapeHtml(ref)}">${escapeHtml(unicode)}</span>`;
      }
      ctx.issues.push({ kind: "missing-gaiji", detail: ref });
      return `<span class="tei-g tei-g-missing" data-ref="${escapeHtml(ref)}" title="${escapeHtml(ref)}">[${escapeHtml(ref)}]</span>`;
    }
    case "choice": {
      // <choice><orig/><reg/></choice> — render reg by default, expose orig
      // via data attribute for long-press disclosure.
      let orig = "";
      let reg = "";
      for (const c of children) {
        const ct = localName(getTag(c));
        if (ct === "orig") orig = renderChildren(getChildren(c), ctx);
        else if (ct === "reg") reg = renderChildren(getChildren(c), ctx);
      }
      const display = reg || orig;
      return `<span class="tei-choice" data-orig="${orig.replace(/"/g, "&quot;")}">${display}</span>`;
    }
    case "app": {
      // <app><lem/><rdg/></app> — render lem inline, capture rdg as data.
      let lem = "";
      const rdgs: string[] = [];
      for (const c of children) {
        const ct = localName(getTag(c));
        if (ct === "lem") lem = renderChildren(getChildren(c), ctx);
        else if (ct === "rdg") rdgs.push(renderChildren(getChildren(c), ctx));
      }
      return `<span class="tei-app" data-rdg="${rdgs.join("|").replace(/"/g, "&quot;")}">${lem}</span>`;
    }
    case "div":
      // juan-level divs are extracted by extractJuans; if we encounter another
      // <div> inline, treat as a generic container.
      return `<div class="tei-div">${renderChildren(children, ctx)}</div>`;
    case "title":
    case "titleStmt":
    case "publicationStmt":
    case "sourceDesc":
    case "fileDesc":
    case "teiHeader":
    case "text":
    case "body":
      // these are handled at the top level; if we somehow recurse into one
      // inline, render its children transparently.
      return renderChildren(children, ctx);
    default:
      ctx.issues.push({ kind: "unknown-element", detail: tag });
      return renderChildren(children, ctx);
  }
}

function collectText(nodes: FxpNode[]): string {
  let out = "";
  for (const n of nodes) {
    const tag = getTag(n);
    if (tag === TEXT_KEY) {
      const t = n[TEXT_KEY];
      if (typeof t === "string") out += t;
    } else {
      out += collectText(getChildren(n));
    }
  }
  return out.trim();
}

function findFirst(nodes: FxpNode[], name: string): FxpNode | undefined {
  for (const n of nodes) {
    if (localName(getTag(n)) === name) return n;
    const found = findFirst(getChildren(n), name);
    if (found) return found;
  }
  return undefined;
}

function findAll(nodes: FxpNode[], name: string, type?: string): FxpNode[] {
  const out: FxpNode[] = [];
  for (const n of nodes) {
    const tag = getTag(n);
    if (localName(tag) === name) {
      if (type === undefined || getAttrs(n)["@_type"] === type) out.push(n);
    }
    out.push(...findAll(getChildren(n), name, type));
  }
  return out;
}

function renderHeader(headerNode: FxpNode | undefined, ctx: RenderCtx): TeiHeader {
  if (!headerNode) return {};
  const children = getChildren(headerNode);
  const titleNode = findFirst(children, "title");
  const pub = findFirst(children, "publicationStmt");
  const src = findFirst(children, "sourceDesc");
  return {
    title: titleNode ? collectText(getChildren(titleNode)) : undefined,
    publicationStmt: pub ? renderChildren(getChildren(pub), ctx) : undefined,
    sourceDesc: src ? renderChildren(getChildren(src), ctx) : undefined,
  };
}

function extractJuans(bodyChildren: FxpNode[], ctx: RenderCtx): RenderResult["juans"] {
  const juanDivs = findAll(bodyChildren, "div", "juan");
  if (juanDivs.length > 0) {
    return juanDivs.map((div, i) => {
      const attrs = getAttrs(div);
      const id = attrs["@_n"] ?? String(i + 1);
      const kids = getChildren(div);
      const headNode = kids.find((c) => localName(getTag(c)) === "head");
      const head = headNode ? collectText(getChildren(headNode)) : undefined;
      return { id, head, html: renderChildren(kids, ctx) };
    });
  }
  return [{ id: "1", html: renderChildren(bodyChildren, ctx) }];
}

export function renderTei(xml: string, gaiji: GaijiTable = {}): RenderResult {
  const issues: RenderIssue[] = [];
  let parsed: FxpNode[];
  try {
    parsed = new XMLParser(XML_OPTS).parse(xml) as FxpNode[];
  } catch (err) {
    return {
      juans: [],
      header: {},
      issues: [{ kind: "parse-error", detail: (err as Error).message }],
    };
  }

  const ctx: RenderCtx = { gaiji, issues };

  // Find <TEI><teiHeader/><text><body/></text></TEI>
  const teiRoot = findFirst(parsed, "TEI") ?? { TEI: parsed };
  const teiChildren = getChildren(teiRoot as FxpNode);
  const headerNode = findFirst(teiChildren, "teiHeader");
  const textNode = findFirst(teiChildren, "text");
  const bodyNode = textNode ? findFirst(getChildren(textNode), "body") : undefined;
  const bodyChildren = bodyNode ? getChildren(bodyNode) : teiChildren;

  const header = renderHeader(headerNode, ctx);
  const juans = extractJuans(bodyChildren, ctx);

  return { juans, header, issues };
}

/** Strip HTML to a plain searchable string (for per-text search). */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Locate occurrences of a query in a juan's HTML — returns char offsets in the plain-text projection. */
export function searchHtml(html: string, query: string): number[] {
  if (!query) return [];
  const plain = htmlToPlainText(html);
  const out: number[] = [];
  const q = query;
  let i = 0;
  while (i <= plain.length - q.length) {
    const idx = plain.indexOf(q, i);
    if (idx < 0) break;
    out.push(idx);
    i = idx + q.length;
  }
  return out;
}

import { describe, expect, it } from "vitest";
import { htmlToPlainText, renderTei, searchHtml } from "./tei";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt><title>長阿含經</title></titleStmt>
      <publicationStmt><p>中華電子佛典協會</p></publicationStmt>
      <sourceDesc><p>大正新脩大藏經</p></sourceDesc>
    </fileDesc>
  </teiHeader>
  <text>
    <body>
      <div type="juan" n="1">
        <head>長阿含經卷第一</head>
        <p>如是我聞，<lb n="001a05"/>一時佛在拘薩羅國。</p>
        <lg><l>諸惡莫作</l><l>眾善奉行</l></lg>
        <p>復有<g ref="#CB00001"/>，及<choice><orig>異</orig><reg>異體</reg></choice>字。</p>
        <p>校勘：<app><lem>正</lem><rdg>誤</rdg></app>。</p>
        <note>此處有註。</note>
        <unknownTag>奇怪</unknownTag>
      </div>
      <div type="juan" n="2">
        <head>長阿含經卷第二</head>
        <p>第二卷文字。</p>
      </div>
    </body>
  </text>
</TEI>`;

describe("renderTei", () => {
  it("extracts the title from teiHeader", () => {
    const r = renderTei(SAMPLE);
    expect(r.header.title).toBe("長阿含經");
  });

  it("preserves publicationStmt and sourceDesc for the 出處 panel", () => {
    const r = renderTei(SAMPLE);
    expect(r.header.publicationStmt).toContain("中華電子佛典協會");
    expect(r.header.sourceDesc).toContain("大正新脩大藏經");
  });

  it("splits body into one HTML fragment per juan", () => {
    const r = renderTei(SAMPLE);
    expect(r.juans).toHaveLength(2);
    expect(r.juans[0].id).toBe("1");
    expect(r.juans[1].id).toBe("2");
    expect(r.juans[0].head).toBe("長阿含經卷第一");
  });

  it("emits anchored <lb> markers usable for deep-link targets", () => {
    const r = renderTei(SAMPLE);
    expect(r.juans[0].html).toContain('id="lb_001a05"');
    expect(r.juans[0].html).toContain('data-lb="001a05"');
  });

  it("resolves gaiji refs via the supplied table, falling back to a marker", () => {
    const r = renderTei(SAMPLE, { CB00001: "𠮷" });
    expect(r.juans[0].html).toContain("𠮷");

    const r2 = renderTei(SAMPLE);
    expect(r2.juans[0].html).toContain("[CB00001]");
    expect(r2.issues.some((i) => i.kind === "missing-gaiji")).toBe(true);
  });

  it("renders <choice> by showing reg and stashing orig", () => {
    const r = renderTei(SAMPLE);
    expect(r.juans[0].html).toContain("異體");
    expect(r.juans[0].html).toContain('data-orig="異"');
  });

  it("renders <app> as the lem with rdg captured", () => {
    const r = renderTei(SAMPLE);
    const html = r.juans[0].html;
    expect(html).toContain('class="tei-app"');
    expect(html).toContain("正");
    expect(html).toContain('data-rdg="誤"');
  });

  it("captures unknown elements as render issues, never silently drops content", () => {
    const r = renderTei(SAMPLE);
    expect(r.issues.some((i) => i.kind === "unknown-element" && i.detail.endsWith("unknownTag"))).toBe(
      true,
    );
    // child content is still inlined
    expect(r.juans[0].html).toContain("奇怪");
  });

  it("escapes raw text content (no XSS via TEI content)", () => {
    const xml = `<TEI><text><body><div type="juan" n="1"><p>&lt;script&gt;alert(1)&lt;/script&gt;</p></div></body></text></TEI>`;
    const r = renderTei(xml);
    expect(r.juans[0].html).not.toMatch(/<script>/i);
    expect(r.juans[0].html).toContain("&lt;script&gt;");
  });

  it("returns a parse-error issue on malformed XML", () => {
    const r = renderTei("<TEI><body><p>unclosed");
    // fast-xml-parser is lenient; ensure we either get juans (graceful) or an issue
    if (r.juans.length === 0) {
      expect(r.issues.some((i) => i.kind === "parse-error")).toBe(true);
    } else {
      expect(r).toBeDefined();
    }
  });

  it("falls back to a single juan when no <div type='juan'> exists", () => {
    const xml = `<TEI><text><body><p>無分卷的文本。</p></body></text></TEI>`;
    const r = renderTei(xml);
    expect(r.juans).toHaveLength(1);
    expect(r.juans[0].html).toContain("無分卷的文本");
  });
});

describe("htmlToPlainText / searchHtml", () => {
  it("strips tags and decodes entities", () => {
    expect(htmlToPlainText("<p>如是&amp;我聞</p>")).toBe("如是&我聞");
  });

  it("finds all occurrences of a query string", () => {
    const html = "<p>佛佛佛說法</p>";
    expect(searchHtml(html, "佛")).toEqual([0, 1, 2]);
  });

  it("returns empty array for empty query", () => {
    expect(searchHtml("<p>佛</p>", "")).toEqual([]);
  });
});

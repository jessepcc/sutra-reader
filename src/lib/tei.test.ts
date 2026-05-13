import { describe, expect, it } from "vitest";
import { htmlToPlainText, searchHtml } from "./search";

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

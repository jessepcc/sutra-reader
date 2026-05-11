import { describe, expect, it } from "vitest";
import { formatDeepLink, parseDeepLink } from "./deep-link";

describe("parseDeepLink", () => {
  it("parses /read/<id>", () => {
    expect(parseDeepLink("/read/T01n0001", "")).toEqual({ textId: "T01n0001" });
  });

  it("parses /read/<id>#lb_xxx", () => {
    expect(parseDeepLink("/read/T01n0001", "#lb_001a05")).toEqual({
      textId: "T01n0001",
      lb: "001a05",
    });
  });

  it("tolerates a trailing slash", () => {
    expect(parseDeepLink("/read/T01n0001/", "")).toEqual({ textId: "T01n0001" });
  });

  it("returns null for non-read paths", () => {
    expect(parseDeepLink("/saved", "#lb_x")).toBeNull();
    expect(parseDeepLink("/browse/T", "")).toBeNull();
  });

  it("decodes the textId", () => {
    expect(parseDeepLink("/read/T01n0001%5F001", "")).toEqual({ textId: "T01n0001_001" });
  });
});

describe("formatDeepLink", () => {
  it("renders the bare path", () => {
    expect(formatDeepLink({ textId: "T01n0001" })).toBe("/read/T01n0001");
  });

  it("appends the lb hash when present", () => {
    expect(formatDeepLink({ textId: "T01n0001", lb: "001a05" })).toBe(
      "/read/T01n0001#lb_001a05",
    );
  });

  it("encodes special characters in textId", () => {
    expect(formatDeepLink({ textId: "T01/odd" })).toBe("/read/T01%2Fodd");
  });
});

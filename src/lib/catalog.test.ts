import { describe, expect, it } from "vitest";
import {
  filterGated,
  findCanon,
  findText,
  findVolume,
  groupByCanon,
  isGatedCanon,
  isGatedVolume,
} from "./catalog";
import type { Catalog } from "./types";

function fixture(): Catalog {
  return {
    generatedAt: "2026-01-01T00:00:00Z",
    upstreamSha: "abc123",
    canons: [
      { id: "T", abbr: "T", name: "大正藏" },
      { id: "X", abbr: "X", name: "卍續藏" },
      { id: "LC", abbr: "LC", name: "呂澂佛學著作集" }, // gated
    ],
    volumes: [
      { canon: "T", id: "T01", label: "第一冊" },
      { canon: "T", id: "T02", label: "第二冊" },
      { canon: "T", id: "Y01", label: "印順法師 第一冊" }, // gated by prefix
      { canon: "X", id: "X01", label: "第一冊" },
      { canon: "LC", id: "LC01", label: "第一冊" }, // gated by canon
    ],
    texts: [
      {
        canon: "T",
        volume: "T01",
        id: "T01n0001_001",
        title: "長阿含經",
        path: "T/T01/T01n0001_001.xml",
        sha: "sha-001",
        bytes: 12345,
      },
      {
        canon: "T",
        volume: "T02",
        id: "T02n0099_001",
        title: "雜阿含經",
        path: "T/T02/T02n0099_001.xml",
        sha: "sha-099",
      },
      {
        canon: "T",
        volume: "Y01",
        id: "Y01n0001",
        title: "妙雲集",
        path: "T/Y01/Y01n0001.xml",
        sha: "sha-y",
      },
      {
        canon: "LC",
        volume: "LC01",
        id: "LC01n0001",
        title: "呂澂",
        path: "LC/LC01/LC01n0001.xml",
        sha: "sha-lc",
      },
      {
        canon: "X",
        volume: "X01",
        id: "X01n0001",
        title: "卍續藏經",
        path: "X/X01/X01n0001.xml",
        sha: "sha-x",
      },
    ],
  };
}

describe("isGatedCanon / isGatedVolume", () => {
  it("flags LC as gated", () => {
    expect(isGatedCanon("LC")).toBe(true);
    expect(isGatedCanon("T")).toBe(false);
  });

  it("flags Yinshun (Y…) and Taixu (TX…) volume prefixes", () => {
    expect(isGatedVolume("Y01")).toBe(true);
    expect(isGatedVolume("TX01")).toBe(true);
    expect(isGatedVolume("T01")).toBe(false);
  });
});

describe("filterGated", () => {
  it("removes gated canons, volumes, and their texts", () => {
    const out = filterGated(fixture());
    expect(out.canons.map((c) => c.id)).toEqual(["T", "X"]);
    expect(out.volumes.map((v) => v.id)).toEqual(["T01", "T02", "X01"]);
    expect(out.texts.map((t) => t.id)).toEqual([
      "T01n0001_001",
      "T02n0099_001",
      "X01n0001",
    ]);
  });

  it("is pure (does not mutate input)", () => {
    const cat = fixture();
    const before = JSON.stringify(cat);
    filterGated(cat);
    expect(JSON.stringify(cat)).toBe(before);
  });
});


describe("groupByCanon", () => {
  it("buckets texts by canon then volume", () => {
    const cat = filterGated(fixture());
    const grouped = groupByCanon(cat);
    expect(grouped.size).toBe(2); // T, X
    const t = [...grouped.keys()].find((c) => c.id === "T")!;
    const tVols = grouped.get(t)!;
    expect(tVols.size).toBe(2);
    const volumesIds = [...tVols.keys()].map((v) => v.id).sort();
    expect(volumesIds).toEqual(["T01", "T02"]);
  });

  it("skips orphan texts whose canon/volume is unknown", () => {
    const cat: Catalog = {
      ...fixture(),
      texts: [
        {
          canon: "UNKNOWN",
          volume: "UNKNOWN",
          id: "X",
          title: "X",
          path: "X",
          sha: "X",
        },
      ],
    };
    expect(groupByCanon(cat).size).toBe(0);
  });
});

describe("find helpers", () => {
  it("locate by id", () => {
    const cat = fixture();
    expect(findText(cat, "T01n0001_001")?.title).toBe("長阿含經");
    expect(findCanon(cat, "T")?.name).toBe("大正藏");
    expect(findVolume(cat, "T01")?.label).toBe("第一冊");
    expect(findText(cat, "nope")).toBeUndefined();
  });
});


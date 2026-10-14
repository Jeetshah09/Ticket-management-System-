import { describe, expect, it } from "vitest";
import { toPaginated, buildQuery } from "@/lib/api-utils";

describe("toPaginated", () => {
  it("passes through the canonical envelope", () => {
    const result = toPaginated<{ id: string }>({
      items: [{ id: "a" }],
      total: 1,
      page: 2,
      page_size: 10,
      pages: 3,
    });
    expect(result).toEqual({
      items: [{ id: "a" }],
      total: 1,
      page: 2,
      page_size: 10,
      pages: 3,
    });
  });

  it("adapts a { data, meta } backend variant", () => {
    const result = toPaginated<{ id: string }>({
      data: [{ id: "a" }, { id: "b" }],
      meta: { total: 25, current_page: 2, per_page: 2 },
    });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(25);
    expect(result.page).toBe(2);
    expect(result.page_size).toBe(2);
    expect(result.pages).toBe(13);
  });

  it("computes pages when the backend omits them", () => {
    const result = toPaginated<unknown>({
      items: new Array(11).fill({}),
      total: 21,
      page: 1,
      page_size: 10,
    });
    expect(result.pages).toBe(3);
  });

  it("handles null/undefined without throwing", () => {
    expect(toPaginated(null)).toEqual({
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      pages: 1,
    });
    expect(toPaginated(undefined).items).toEqual([]);
  });
});

describe("buildQuery", () => {
  it("drops undefined, null, and empty-string values", () => {
    expect(
      buildQuery({ a: 1, b: undefined, c: null, d: "", e: "x", f: 0 })
    ).toEqual({ a: "1", e: "x", f: "0" });
  });

  it("handles undefined input", () => {
    expect(buildQuery(undefined)).toEqual({});
  });
});

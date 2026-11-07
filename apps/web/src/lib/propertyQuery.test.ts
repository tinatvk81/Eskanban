import { describe, expect, it } from "vitest";
import { buildApiQuery, parseFilters, uiQuery } from "./propertyQuery";

describe("parseFilters", () => {
  it("normalizes Persian digits and trims the search text", () => {
    const f = parseFilters({ pmin: "۵۰۰", rmin: "۲", q: "  ali  " });
    expect(f.pmin).toBe("500");
    expect(f.rmin).toBe("2");
    expect(f.q).toBe("ali");
  });
  it("falls back to safe defaults for invalid input", () => {
    const f = parseFilters({ sort: "hack:desc", status: "zzz", page: "-3", deal: "x" });
    expect(f.sort).toBe("created_at:desc");
    expect(f.status).toBe("active");
    expect(f.page).toBe(1);
    expect(f.deal).toBe("");
  });
});

describe("buildApiQuery", () => {
  it("maps UI filters to API parameters and converts million Toman", () => {
    const qs = buildApiQuery(
      parseFilters({ pmin: "500", urgent: "1", sort: "price:asc", deal: "rent", page: "2" }),
    );
    const p = new URLSearchParams(qs);
    expect(p.get("min_price")).toBe("500000000");
    expect(p.get("urgent_only")).toBe("true");
    expect(p.get("sort_by")).toBe("price");
    expect(p.get("order")).toBe("asc");
    expect(p.getAll("deal_type")).toEqual(["rent"]);
    expect(p.get("page")).toBe("2");
    expect(p.get("status")).toBe("active");
  });
});

describe("uiQuery", () => {
  it("is empty for defaults and keeps only changed values", () => {
    expect(uiQuery(parseFilters({}))).toBe("");
    expect(uiQuery(parseFilters({ q: "x", deal: "sale", page: "3" }))).toBe("q=x&deal=sale&page=3");
  });
});
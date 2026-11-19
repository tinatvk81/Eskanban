import { describe, expect, it } from "vitest";
import { buildApiQuery, filesHref, parseFilters, uiQuery } from "./propertyQuery";

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

describe("filesHref", () => {
  it("builds the list URL and drops default values", () => {
    const f = parseFilters({});
    expect(filesHref("fa", f)).toBe("/fa/files");
    expect(filesHref("en", f, 3)).toBe("/en/files?page=3");
  });

  it("keeps changed filters when moving to another page", () => {
    const f = parseFilters({ deal: "rent", urgent: "1" });
    expect(filesHref("fa", f, 2)).toBe("/fa/files?deal=rent&urgent=1&page=2");
  });
});


describe("geography filters", () => {
  it("parses city ID and district", () => {
    const f = parseFilters({
      city: "۱۲۳",
      district: "  سجاد  ",
    });

    expect(f.city).toBe("123");
    expect(f.district).toBe("سجاد");
  });

  it("maps geography filters to API parameters", () => {
    const f = parseFilters({
      city: "123",
      district: "سجاد",
    });

    const p = new URLSearchParams(buildApiQuery(f));

    expect(p.get("city_id")).toBe("123");
    expect(p.get("district")).toBe("سجاد");
  });

  it("preserves geography filters in page URLs", () => {
    const f = parseFilters({
      city: "123",
      district: "سجاد",
    });

    expect(filesHref("fa", f, 2)).toBe(
      "/fa/files?page=2&city=123&district=%D8%B3%D8%AC%D8%A7%D8%AF",
    );
  });
});
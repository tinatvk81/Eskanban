import { describe, expect, it } from "vitest";
import {
  describeChange,
  formatDate,
  formatPlain,
  isUuid,
  safeHttpUrl,
  telHref,
} from "./propertyDetail";

describe("isUuid", () => {
  it("accepts a UUID and rejects path tricks", () => {
    expect(isUuid("3f2b8c1e-0a4d-4b7e-9c55-1d2e3f4a5b6c")).toBe(true);
    expect(isUuid("../auth/me")).toBe(false);
    expect(isUuid("123")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});

describe("safeHttpUrl", () => {
  it("allows http(s) only", () => {
    expect(safeHttpUrl("https://maps.example.com/x")).toBe("https://maps.example.com/x");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
});

describe("telHref", () => {
  it("normalizes Persian digits and strips separators", () => {
    expect(telHref("۰۹۱۲-۱۲۳ ۴۵۶۷")).toBe("tel:09121234567");
    expect(telHref("+98 912 123 4567")).toBe("tel:+989121234567");
    expect(telHref("abc")).toBeNull();
    expect(telHref(null)).toBeNull();
  });
});

describe("describeChange", () => {
  it("renders old/new pairs in all known shapes", () => {
    expect(describeChange({ old: 1, new: 2 })).toBe("1 → 2");
    expect(describeChange({ from: "a", to: null })).toBe("a → —");
    expect(describeChange({ before: true, after: false })).toBe("true → false");
  });
  it("renders plain values, arrays and unknown objects safely", () => {
    expect(describeChange("x")).toBe("x");
    expect(describeChange(null)).toBe("—");
    expect(describeChange(["a", "b"])).toBe("a, b");
    expect(describeChange({ k: 1 })).toBe('{"k":1}');
  });
  it("clips very long text", () => {
    const out = describeChange("a".repeat(500));
    expect(out.length).toBeLessThanOrEqual(121);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("formatDate / formatPlain", () => {
  it("returns null for empty or invalid dates", () => {
    expect(formatDate(null, "fa")).toBeNull();
    expect(formatDate("garbage", "en")).toBeNull();
  });
  it("does not shift date-only values", () => {
    expect(formatDate("2026-11-19", "en")).toBe("Nov 19, 2026");
  });
  it("formats plain numbers without grouping", () => {
    expect(formatPlain(1403, "en")).toBe("1403");
    expect(formatPlain(null, "fa")).toBeNull();
  });
});

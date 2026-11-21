import { describe, expect, it } from "vitest";
import { buildCreateRequest } from "./propertyCreate";
import {
  buildCreatePayload,
  EMPTY_FORM,
  normalizeDigits,
  parseDate,
  parseDecimal,
  parseInteger,
  type FormValues,
} from "./propertyForm";

const OWNER = "3f2b8c1e-5d4a-4b7e-9c1a-2f6d8e0a1b3c";
const base: FormValues = { ...EMPTY_FORM, deal_type: "sale", city_id: "12" };

describe("normalizeDigits", () => {
  const cases: Array<[string, string]> = [
    ["۱۲۳", "123"],
    ["٤٥٦", "456"],
    ["a۱b٢", "a1b2"],
    ["123", "123"],
  ];
  it.each(cases)("converts %s to %s", (input, expected) => {
    expect(normalizeDigits(input)).toBe(expected);
  });
});

describe("parseInteger", () => {
  it("reads Persian digits with thousands separators", () => {
    expect(parseInteger("۵٬۰۰۰٬۰۰۰٬۰۰۰", 0, 10 ** 13)).toEqual({ ok: true, value: 5_000_000_000 });
    expect(parseInteger("5،000", 0, 10 ** 13)).toEqual({ ok: true, value: 5000 });
    expect(parseInteger(" 12 ", 0, 100)).toEqual({ ok: true, value: 12 });
  });

  it("treats an empty value as not set", () => {
    expect(parseInteger("", 0, 10)).toEqual({ ok: true, value: null });
    expect(parseInteger("   ", 0, 10)).toEqual({ ok: true, value: null });
  });

  const invalid: Array<[string]> = [["abc"], ["12.5"], ["1e3"], ["--1"]];
  it.each(invalid)("rejects %s as invalid", (input) => {
    expect(parseInteger(input, 0, 100)).toEqual({ ok: false, error: "invalid" });
  });

  it("reports values outside the range", () => {
    expect(parseInteger("-1", 0, 100)).toEqual({ ok: false, error: "range" });
    expect(parseInteger("101", 0, 100)).toEqual({ ok: false, error: "range" });
    expect(parseInteger("10000000000001", 0, 10 ** 13)).toEqual({ ok: false, error: "range" });
  });
});

describe("parseDecimal", () => {
  it("reads a Persian decimal separator", () => {
    expect(parseDecimal("۱۲۰٫۵", 0, 1_000_000)).toEqual({ ok: true, value: 120.5 });
    expect(parseDecimal("90", 0, 1_000_000)).toEqual({ ok: true, value: 90 });
  });

  it("rejects negatives, text and more than two decimals", () => {
    expect(parseDecimal("-1", 0, 1_000_000)).toEqual({ ok: false, error: "invalid" });
    expect(parseDecimal("abc", 0, 1_000_000)).toEqual({ ok: false, error: "invalid" });
    expect(parseDecimal("120.555", 0, 1_000_000)).toEqual({ ok: false, error: "invalid" });
  });

  it("reports out-of-range and empty values", () => {
    expect(parseDecimal("1000001", 0, 1_000_000)).toEqual({ ok: false, error: "range" });
    expect(parseDecimal("", 0, 1_000_000)).toEqual({ ok: true, value: null });
  });
});

describe("parseDate", () => {
  it("accepts a real Gregorian date, including Persian digits", () => {
    expect(parseDate("2026-12-01")).toEqual({ ok: true, value: "2026-12-01" });
    expect(parseDate("۲۰۲۶-۱۲-۰۱")).toEqual({ ok: true, value: "2026-12-01" });
    expect(parseDate("")).toEqual({ ok: true, value: null });
  });

  const bad: Array<[string]> = [["2026-02-30"], ["1403/01/01"], ["2026-13-01"], ["tomorrow"]];
  it.each(bad)("rejects %s", (input) => {
    expect(parseDate(input)).toEqual({ ok: false, error: "date" });
  });
});

describe("buildCreatePayload", () => {
  it("sends only the required fields and the defaults for a minimal form", () => {
    expect(buildCreatePayload(base)).toEqual({
      ok: true,
      body: {
        deal_type: "sale",
        city_id: 12,
        property_types: [],
        amenities: [],
        custom_amenities: [],
        is_corner: false,
        is_urgent: false,
        ownership_dang: 6,
      },
    });
  });

  it("reports the two required fields on an empty form", () => {
    expect(buildCreatePayload(EMPTY_FORM)).toEqual({
      ok: false,
      errors: { deal_type: "required", city_id: "required" },
    });
  });

  it("reports an invalid city id", () => {
    expect(buildCreatePayload({ ...base, city_id: "abc" })).toEqual({
      ok: false,
      errors: { city_id: "invalid" },
    });
  });

  const full: FormValues = {
    ...EMPTY_FORM,
    deal_type: "sale",
    property_types: ["apartment", "shop"],
    city_id: "12",
    district: " Vakilabad ",
    address: "Some street",
    location_url: "https://maps.example/x",
    land_area_m2: "۱۲۰٫۵",
    built_area_m2: "90",
    rooms: "۲",
    floor: "-1",
    total_floors: "5",
    total_units: "10",
    build_year: "۱۳۹۵",
    direction: "north",
    is_corner: true,
    amenities: ["elevator"],
    custom_amenities: "x، y\nz, w",
    document_type: "official",
    document_note: "n",
    ownership_dang: "6",
    is_divided: "no",
    deed_scope: "land_and_building",
    ownership_kind: "freehold",
    occupancy: "vacant",
    vacate_date: "2026-12-01",
    owner_name: "Owner",
    owner_phone: "۰۹۱۲۰۰۰۰۰۰۰",
    price_total: "۵٬۰۰۰٬۰۰۰٬۰۰۰",
    price_per_m2: "40,000,000",
    price_note: "negotiable",
    payment_terms: "cash",
    delivery_date: "2027-01-01",
    is_urgent: true,
    urgent_until: "2026-12-10",
    notes: "text",
    owner_user_id: OWNER,
  };

  it("converts a complete form and leaves empty optional fields out", () => {
    const expected = {
      deal_type: "sale",
      property_types: ["apartment", "shop"],
      city_id: 12,
      district: "Vakilabad",
      address: "Some street",
      location_url: "https://maps.example/x",
      land_area_m2: 120.5,
      built_area_m2: 90,
      rooms: 2,
      floor: -1,
      total_floors: 5,
      total_units: 10,
      build_year: 1395,
      direction: "north",
      is_corner: true,
      amenities: ["elevator"],
      custom_amenities: ["x", "y", "z", "w"],
      document_type: "official",
      document_note: "n",
      ownership_dang: 6,
      is_divided: false,
      deed_scope: "land_and_building",
      ownership_kind: "freehold",
      occupancy: "vacant",
      vacate_date: "2026-12-01",
      owner_name: "Owner",
      owner_phone: "09120000000",
      price_total: 5_000_000_000,
      price_per_m2: 40_000_000,
      price_note: "negotiable",
      payment_terms: "cash",
      delivery_date: "2027-01-01",
      is_urgent: true,
      urgent_until: "2026-12-10",
      notes: "text",
      owner_user_id: OWNER,
    };
    expect(buildCreatePayload(full)).toEqual({ ok: true, body: expected });
  });

  it("produces a body the BFF validator accepts unchanged", () => {
    const payload = buildCreatePayload(full);
    if (!payload.ok) throw new Error("expected a valid payload");
    const request = buildCreateRequest(payload.body);
    expect(request).toEqual({ ok: true, path: "/api/v1/properties", body: payload.body });
  });

  it("maps the divided choice to true, false or unknown", () => {
    const body = (is_divided: string) => {
      const result = buildCreatePayload({ ...base, is_divided });
      if (!result.ok) throw new Error("expected a valid payload");
      return result.body;
    };
    expect(body("yes").is_divided).toBe(true);
    expect(body("no").is_divided).toBe(false);
    expect("is_divided" in body("")).toBe(false);
  });

  it("ignores the urgent date unless the file is urgent", () => {
    const result = buildCreatePayload({ ...base, urgent_until: "2026-12-10" });
    if (!result.ok) throw new Error("expected a valid payload");
    expect("urgent_until" in result.body).toBe(false);
  });

  it("drops blank text and an empty owner", () => {
    const result = buildCreatePayload({ ...base, district: "   ", notes: "", owner_user_id: "" });
    if (!result.ok) throw new Error("expected a valid payload");
    expect("district" in result.body).toBe(false);
    expect("notes" in result.body).toBe(false);
    expect("owner_user_id" in result.body).toBe(false);
  });

  it("rejects a map link that is not http(s)", () => {
    expect(buildCreatePayload({ ...base, location_url: "maps.example/x" })).toEqual({
      ok: false,
      errors: { location_url: "url" },
    });
  });

  it("collects every field error at once", () => {
    expect(
      buildCreatePayload({
        ...base,
        price_total: "abc",
        floor: "99999",
        contract_end_date: "bad",
      }),
    ).toEqual({
      ok: false,
      errors: { price_total: "invalid", floor: "range", contract_end_date: "date" },
    });
  });
});

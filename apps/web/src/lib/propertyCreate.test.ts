import { describe, expect, it } from "vitest";
import { buildCreateRequest } from "./propertyCreate";

const OWNER = "3f2b8c1e-5d4a-4b7e-9c1a-2f6d8e0a1b3c";
const minimal = { deal_type: "sale", city_id: 1 };

function ok(raw: unknown) {
  const result = buildCreateRequest(raw);
  if (!result.ok) throw new Error(`expected ok, got ${result.status}: ${result.message}`);
  return result;
}

function rejected(raw: unknown) {
  const result = buildCreateRequest(raw);
  if (result.ok) throw new Error("expected a rejection");
  return result;
}

describe("buildCreateRequest", () => {
  it("forwards a minimal valid body to the create endpoint", () => {
    expect(ok(minimal)).toEqual({ ok: true, path: "/api/v1/properties", body: minimal });
  });

  it("drops unknown and server-controlled fields", () => {
    const result = ok({
      ...minimal,
      agency_id: "other-agency",
      id: "x",
      version: 3,
      status: "closed",
      created_at: "2026-01-01",
    });
    expect(result.body).toEqual(minimal);
  });

  const notObjects: Array<[unknown]> = [[null], [undefined], [[]], ["x"], [5]];
  it.each(notObjects)("rejects a body that is not a JSON object (%j)", (raw) => {
    expect(rejected(raw)).toMatchObject({ status: 422, code: "invalid_input" });
  });

  const badRequired: Array<[unknown, string]> = [
    [{ city_id: 1 }, "deal_type"],
    [{ deal_type: "", city_id: 1 }, "deal_type"],
    [{ deal_type: 5, city_id: 1 }, "deal_type"],
    [{ deal_type: "sale" }, "city_id"],
    [{ deal_type: "sale", city_id: 0 }, "city_id"],
    [{ deal_type: "sale", city_id: 1.5 }, "city_id"],
    [{ deal_type: "sale", city_id: "1" }, "city_id"],
  ];
  it.each(badRequired)("rejects an invalid required field: %j", (raw, field) => {
    const result = rejected(raw);
    expect(result).toMatchObject({ status: 422, code: "invalid_input" });
    expect(result.message).toContain(field);
  });

  it("forwards every valid optional field unchanged, including nulls", () => {
    const full = {
      ...minimal,
      property_types: ["apartment"],
      district: "Vakilabad",
      address: "Some street",
      location_url: "https://maps.example/x",
      land_area_m2: 120.5,
      built_area_m2: null,
      rooms: 2,
      floor: -1,
      total_floors: 5,
      total_units: 10,
      build_year: 1395,
      direction: "north",
      is_corner: true,
      amenities: ["elevator", "parking"],
      custom_amenities: ["extra"],
      document_type: "official",
      document_note: "note",
      ownership_dang: 6,
      is_divided: null,
      deed_scope: "land_and_building",
      ownership_kind: "freehold",
      occupancy: "vacant",
      vacate_date: "2026-12-01",
      owner_name: "Owner",
      owner_phone: "09120000000",
      price_total: 5_000_000_000,
      price_per_m2: null,
      deposit: null,
      monthly_rent: null,
      payment_terms: "terms",
      contract_end_date: null,
      delivery_date: "2027-01-01",
      is_urgent: true,
      urgent_until: "2026-12-10",
      notes: "text",
    };
    expect(ok(full).body).toEqual(full);
  });

  const badOptional: Array<[string, unknown]> = [
    ["price_total", "1000"],
    ["price_total", -1],
    ["price_total", 1.5],
    ["price_total", 10 ** 13 + 1],
    ["land_area_m2", "10"],
    ["land_area_m2", -5],
    ["rooms", 101],
    ["floor", 1.5],
    ["build_year", 1700],
    ["ownership_dang", 7],
    ["ownership_dang", null],
    ["is_corner", "yes"],
    ["is_urgent", null],
    ["property_types", "apartment"],
    ["property_types", [1]],
    ["amenities", Array.from({ length: 41 }, (_, i) => `a${i}`)],
    ["contract_end_date", "1403/01/01"],
    ["vacate_date", 20261201],
    ["notes", "x".repeat(2001)],
    ["district", 5],
  ];
  it.each(badOptional)("rejects an invalid %s: %j", (field, value) => {
    const result = rejected({ ...minimal, [field]: value });
    expect(result).toMatchObject({ status: 422, code: "invalid_input" });
    expect(result.message).toBe(`invalid ${field}`);
  });

  it("keeps only deposit and monthly_rent in convertible options", () => {
    const result = ok({
      ...minimal,
      convertible_options: [{ deposit: 100, monthly_rent: 5, extra: "ignored" }],
    });
    expect(result.body.convertible_options).toEqual([{ deposit: 100, monthly_rent: 5 }]);
  });

  const badOptions: Array<[unknown]> = [
    ["x"],
    [[{ deposit: 1 }]],
    [[{ deposit: -1, monthly_rent: 1 }]],
    [[{ deposit: 1, monthly_rent: "2" }]],
    [Array.from({ length: 11 }, () => ({ deposit: 1, monthly_rent: 1 }))],
  ];
  it.each(badOptions)("rejects invalid convertible_options: %j", (options) => {
    expect(rejected({ ...minimal, convertible_options: options }).message).toBe(
      "invalid convertible_options",
    );
  });

  it("forwards a valid owner_user_id and omits a null one", () => {
    expect(ok({ ...minimal, owner_user_id: OWNER }).body.owner_user_id).toBe(OWNER);
    expect(ok({ ...minimal, owner_user_id: null }).body).toEqual(minimal);
  });

  const badOwners: Array<[unknown]> = [["abc"], [5], [""]];
  it.each(badOwners)("rejects an invalid owner_user_id: %j", (owner) => {
    expect(rejected({ ...minimal, owner_user_id: owner }).message).toBe("invalid owner_user_id");
  });
});

import { describe, expect, it } from "vitest";
import { buildUpdateRequest } from "./propertyCreate";
import { buildUpdatePayload, EMPTY_FORM, propertyToFormValues } from "./propertyForm";
import type { PropertyDetail } from "./propertyTypes";

const ID = "3f2b8c1e-5d4a-4b7e-9c1a-2e6f8a9b0c3d";
const OWNER = "7a1d4c2e-9b3f-4e5a-8c6d-1f2a3b4c5d6e";

const prop: PropertyDetail = {
  id: ID,
  version: 4,
  status: "active",
  deal_type: "rent",
  property_types: ["apartment"],
  owner: { id: OWNER, full_name: "Ali" },
  shared_with_agency: false,
  is_favorite: false,
  city: { id: 514, name: "مشهد", province_id: 11, province_name: "خراسان رضوی" },
  district: "سجاد",
  main_area_m2: 95,
  rooms: 2,
  floor: 3,
  price_total: null,
  deposit: 200_000_000,
  monthly_rent: 8_000_000,
  contract_end_date: "2027-03-20",
  is_urgent_now: true,
  deal_date: null,
  can_edit: true,
  address: "وکیل‌آباد",
  location_url: "https://maps.example.com/x",
  land_area_m2: 120.5,
  built_area_m2: "95",
  total_floors: 5,
  total_units: 10,
  build_year: 1395,
  direction: "south",
  is_corner: true,
  amenities: ["parking", "elevator"],
  custom_amenities: ["بالکن", "انباری"],
  document_type: "deed",
  document_note: "note",
  ownership_dang: 6,
  is_divided: false,
  deed_scope: "full",
  ownership_kind: "individual",
  occupancy: "owner",
  vacate_date: "2027-01-10",
  owner_name: "Reza",
  owner_phone: "+989121234567",
  price_per_m2: null,
  convertible_options: [{ deposit: 100_000_000, monthly_rent: 12_000_000 }],
  price_note: "negotiable",
  delivery_date: null,
  payment_terms: null,
  is_urgent: true,
  urgent_until: "2026-12-30",
  notes: "some notes",
  last_confirmed_at: "2026-11-01T00:00:00Z",
  review_due_at: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};

const emptyOptional: PropertyDetail = {
  ...prop,
  district: null,
  address: null,
  location_url: null,
  land_area_m2: null,
  built_area_m2: null,
  rooms: null,
  floor: null,
  total_floors: null,
  total_units: null,
  build_year: null,
  direction: null,
  document_type: null,
  document_note: null,
  is_divided: null,
  deed_scope: null,
  ownership_kind: null,
  occupancy: null,
  vacate_date: null,
  owner_name: null,
  owner_phone: null,
  deposit: null,
  monthly_rent: null,
  price_note: null,
  contract_end_date: null,
  urgent_until: null,
  notes: null,
  custom_amenities: [],
};

const EXPECTED_BODY = {
  deal_type: "rent",
  property_types: ["apartment"],
  city_id: 514,
  district: "سجاد",
  address: "وکیل‌آباد",
  location_url: "https://maps.example.com/x",
  land_area_m2: 120.5,
  built_area_m2: 95,
  rooms: 2,
  floor: 3,
  total_floors: 5,
  total_units: 10,
  build_year: 1395,
  direction: "south",
  is_corner: true,
  amenities: ["parking", "elevator"],
  custom_amenities: ["بالکن", "انباری"],
  document_type: "deed",
  document_note: "note",
  ownership_dang: 6,
  is_divided: false,
  deed_scope: "full",
  ownership_kind: "individual",
  occupancy: "owner",
  vacate_date: "2027-01-10",
  owner_name: "Reza",
  owner_phone: "09121234567",
  deposit: 200_000_000,
  monthly_rent: 8_000_000,
  price_note: "negotiable",
  contract_end_date: "2027-03-20",
  is_urgent: true,
  urgent_until: "2026-12-30",
  notes: "some notes",
  convertible_options: [{ deposit: 100_000_000, monthly_rent: 12_000_000 }],
  version: 4,
};

describe("propertyToFormValues", () => {
  it("produces exactly the keys of the create form", () => {
    expect(Object.keys(propertyToFormValues(prop)).sort()).toEqual(Object.keys(EMPTY_FORM).sort());
  });

  it("turns a full file into form strings", () => {
    const v = propertyToFormValues(prop);
    expect(v).toMatchObject({
      city_id: "514",
      land_area_m2: "120.5",
      built_area_m2: "95",
      is_divided: "no",
      custom_amenities: "بالکن\nانباری",
      owner_phone: "09121234567",
      deposit: "200000000",
      ownership_dang: "6",
      owner_user_id: "",
    });
  });

  it("turns null fields into empty strings", () => {
    const v = propertyToFormValues(emptyOptional);
    for (const key of ["district", "address", "land_area_m2", "rooms", "owner_phone", "notes"] as const) {
      expect(v[key]).toBe("");
    }
    expect(v.is_divided).toBe("");
    expect(v.custom_amenities).toBe("");
  });

  it("maps is_divided true to yes", () => {
    expect(propertyToFormValues({ ...prop, is_divided: true }).is_divided).toBe("yes");
  });

  it("shows +98 numbers in the local shape and leaves other numbers alone", () => {
    expect(propertyToFormValues({ ...prop, owner_phone: "+985138000000" }).owner_phone).toBe("05138000000");
    expect(propertyToFormValues({ ...prop, owner_phone: "09121234567" }).owner_phone).toBe("09121234567");
  });
});

describe("buildUpdatePayload round trip", () => {
  it("saving a loaded file without changes sends exactly the same data", () => {
    const r = buildUpdatePayload(propertyToFormValues(prop), prop.version, prop.convertible_options);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).toEqual(EXPECTED_BODY);
  });

  it("is accepted by the BFF validator without losing anything", () => {
    const r = buildUpdatePayload(propertyToFormValues(prop), prop.version, prop.convertible_options);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const req = buildUpdateRequest(ID, r.body);
    expect(req.ok).toBe(true);
    if (req.ok) expect(req.body).toEqual(r.body);
  });

  it("carries convertible_options over as a copy", () => {
    const r = buildUpdatePayload(propertyToFormValues(prop), prop.version, prop.convertible_options);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body.convertible_options).toEqual(prop.convertible_options);
    expect(r.body.convertible_options).not.toBe(prop.convertible_options);
  });

  it("keeps an empty convertible_options empty", () => {
    const r = buildUpdatePayload(propertyToFormValues(prop), prop.version, []);
    expect(r.ok && r.body.convertible_options).toEqual([]);
  });

  it("leaves out a field the user cleared, so the backend resets it", () => {
    const values = { ...propertyToFormValues(prop), address: "" };
    const r = buildUpdatePayload(values, prop.version, prop.convertible_options);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).not.toHaveProperty("address");
  });

  it("sends ownership_dang 6 when it was cleared", () => {
    const values = { ...propertyToFormValues(prop), ownership_dang: "" };
    const r = buildUpdatePayload(values, prop.version, prop.convertible_options);
    expect(r.ok && r.body.ownership_dang).toBe(6);
  });

  it("never sends owner_user_id", () => {
    const values = { ...propertyToFormValues(prop), owner_user_id: OWNER };
    const r = buildUpdatePayload(values, prop.version, prop.convertible_options);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).not.toHaveProperty("owner_user_id");
  });

  it("reports field errors instead of building a body", () => {
    const values = { ...propertyToFormValues(prop), land_area_m2: "abc" };
    const r = buildUpdatePayload(values, prop.version, prop.convertible_options);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.land_area_m2).toBeDefined();
  });
});

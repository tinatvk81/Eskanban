import { describe, expect, it } from "vitest";
import { buildCreateRequest, buildUpdateRequest } from "./propertyCreate";

const ID = "3f2b8c1e-5d4a-4b7e-9c1a-2e6f8a9b0c3d";
const OWNER = "7a1d4c2e-9b3f-4e5a-8c6d-1f2a3b4c5d6e";

const full = {
  deal_type: "rent",
  city_id: 514,
  property_types: ["apartment"],
  amenities: ["parking"],
  custom_amenities: ["بالکن"],
  is_corner: false,
  is_urgent: false,
  ownership_dang: 6,
  convertible_options: [{ deposit: 100_000_000, monthly_rent: 5_000_000 }],
  version: 3,
};

describe("buildUpdateRequest", () => {
  it("builds the PUT path and sends the version", () => {
    const r = buildUpdateRequest(ID, full);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.path).toBe(`/api/v1/properties/${ID}`);
    expect(r.body).toMatchObject({ deal_type: "rent", city_id: 514, version: 3 });
  });

  it("passes convertible_options through unchanged", () => {
    const r = buildUpdateRequest(ID, full);
    expect(r.ok && r.body.convertible_options).toEqual(full.convertible_options);
  });

  it("keeps an explicitly empty convertible_options (the user may have none)", () => {
    const r = buildUpdateRequest(ID, { ...full, convertible_options: [] });
    expect(r.ok && r.body.convertible_options).toEqual([]);
  });

  it("drops owner_user_id and never forwards status, agency_id or id", () => {
    const r = buildUpdateRequest(ID, {
      ...full,
      owner_user_id: OWNER,
      status: "closed",
      agency_id: "x",
      id: "y",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body).not.toHaveProperty("owner_user_id");
    expect(r.body).not.toHaveProperty("status");
    expect(r.body).not.toHaveProperty("agency_id");
    expect(r.body).not.toHaveProperty("id");
  });

  it.each([undefined, 0, -1, 1.5, "3", null])("rejects version %s", (version) => {
    const r = buildUpdateRequest(ID, { ...full, version });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(422);
  });

  it.each([
    "property_types",
    "amenities",
    "custom_amenities",
    "is_corner",
    "is_urgent",
    "ownership_dang",
    "convertible_options",
  ])("rejects a request without %s (it would silently reset on the backend)", (key) => {
    const body: Record<string, unknown> = { ...full };
    delete body[key];
    const r = buildUpdateRequest(ID, body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(`missing ${key}`);
  });

  it("rejects a bad id and a non-object body", () => {
    expect(buildUpdateRequest("not-a-uuid", full).ok).toBe(false);
    expect(buildUpdateRequest(ID, null).ok).toBe(false);
    expect(buildUpdateRequest(ID, []).ok).toBe(false);
  });

  it("applies the same field checks as create", () => {
    expect(buildUpdateRequest(ID, { ...full, rooms: 9999 }).ok).toBe(false);
    expect(buildUpdateRequest(ID, { ...full, city_id: 0 }).ok).toBe(false);
  });

  it("leaves create unchanged: create still ignores version", () => {
    const r = buildCreateRequest({ deal_type: "sale", city_id: 514 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).not.toHaveProperty("version");
  });
});

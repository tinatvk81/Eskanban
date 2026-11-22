import { describe, expect, it } from "vitest";
import { buildListingActionRequest } from "./listingActions";

const VALID_ID = "11111111-1111-1111-1111-111111111111";

describe("buildListingActionRequest", () => {
  it("rejects a non-uuid id", () => {
    const result = buildListingActionRequest("not-a-uuid", "dismiss", undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });

  it("builds a dismiss request", () => {
    const result = buildListingActionRequest(VALID_ID, "dismiss", undefined);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.path).toBe(`/api/v1/listings/${VALID_ID}/dismiss`);
  });

  it("builds a convert request with deal_type and city_id", () => {
    const result = buildListingActionRequest(VALID_ID, "convert", {
      deal_type: "sale",
      city_id: 514,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path).toBe(`/api/v1/listings/${VALID_ID}/convert`);
      expect(result.body).toMatchObject({ deal_type: "sale", city_id: 514 });
    }
  });

  it("rejects convert with a missing deal_type", () => {
    const result = buildListingActionRequest(VALID_ID, "convert", { city_id: 514 });
    expect(result.ok).toBe(false);
  });

  it("rejects convert with an unknown deal_type", () => {
    const result = buildListingActionRequest(VALID_ID, "convert", {
      deal_type: "not_a_type",
      city_id: 514,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects convert with a missing city_id", () => {
    const result = buildListingActionRequest(VALID_ID, "convert", { deal_type: "sale" });
    expect(result.ok).toBe(false);
  });

  it("rejects convert with a non-integer city_id", () => {
    const result = buildListingActionRequest(VALID_ID, "convert", {
      deal_type: "sale",
      city_id: 1.5,
    });
    expect(result.ok).toBe(false);
  });

  it("forwards extra fields on convert", () => {
    const result = buildListingActionRequest(VALID_ID, "convert", {
      deal_type: "sale",
      city_id: 514,
      owner_name: "آقای احمدی",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body).toMatchObject({ owner_name: "آقای احمدی" });
  });

  it("rejects an unknown action", () => {
    const result = buildListingActionRequest(VALID_ID, "explode", undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(404);
  });
});

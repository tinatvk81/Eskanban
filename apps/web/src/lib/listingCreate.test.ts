import { describe, expect, it } from "vitest";
import { buildAddFromLinkRequest } from "./listingCreate";

describe("buildAddFromLinkRequest", () => {
  it("accepts a bare url", () => {
    const result = buildAddFromLinkRequest({ url: "https://divar.ir/v/x" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path).toBe("/api/v1/listings/from-link");
      expect(result.body).toEqual({ url: "https://divar.ir/v/x" });
    }
  });

  it("rejects a missing url", () => {
    const result = buildAddFromLinkRequest({});
    expect(result.ok).toBe(false);
  });

  it("rejects an empty url", () => {
    const result = buildAddFromLinkRequest({ url: "" });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-string url", () => {
    const result = buildAddFromLinkRequest({ url: 123 });
    expect(result.ok).toBe(false);
  });

  it("forwards optional fields when valid", () => {
    const result = buildAddFromLinkRequest({
      url: "https://divar.ir/v/x",
      title: "آپارتمان",
      owner_name: "آقای احمدی",
      owner_phone: "09121112233",
      city_id: 514,
      price_total: 5_000_000_000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.title).toBe("آپارتمان");
      expect(result.body.owner_phone).toBe("09121112233");
      expect(result.body.city_id).toBe(514);
    }
  });

  it("drops empty-string optional fields instead of forwarding them", () => {
    const result = buildAddFromLinkRequest({ url: "https://divar.ir/v/x", title: "" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.title).toBeUndefined();
    }
  });

  it("rejects an out-of-range city_id", () => {
    const result = buildAddFromLinkRequest({ url: "https://divar.ir/v/x", city_id: -1 });
    expect(result.ok).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = buildAddFromLinkRequest({ url: "https://divar.ir/v/x", price_total: -1 });
    expect(result.ok).toBe(false);
  });

  it("rejects property_types with too many items", () => {
    const types = Array.from({ length: 14 }, () => "apartment");
    const result = buildAddFromLinkRequest({ url: "https://divar.ir/v/x", property_types: types });
    expect(result.ok).toBe(false);
  });

  it("accepts valid property_types", () => {
    const result = buildAddFromLinkRequest({
      url: "https://divar.ir/v/x",
      property_types: ["apartment", "villa"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.property_types).toEqual(["apartment", "villa"]);
    }
  });

  it("rejects a non-record body", () => {
    const result = buildAddFromLinkRequest("not an object");
    expect(result.ok).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { buildActionRequest } from "./propertyActions";

const ID = "3f2b8c1e-0a4d-4b7e-9c55-1d2e3f4a5b6c";
const OTHER = "9a8b7c6d-1111-4222-8333-444455556666";

describe("buildActionRequest", () => {
  it("rejects ids that are not UUIDs (no path tricks)", () => {
    for (const bad of ["../auth/me", "123", ""]) {
      const r = buildActionRequest(bad, "favorite", null);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(404);
    }
  });

  it("rejects unknown actions", () => {
    const r = buildActionRequest(ID, "restore", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(404);
  });

  it("maps favorite and soft-delete without a body", () => {
    expect(buildActionRequest(ID, "favorite", null)).toEqual({
      ok: true,
      path: `/api/v1/properties/${ID}/favorite`,
    });
    expect(buildActionRequest(ID, "soft-delete", null)).toEqual({
      ok: true,
      path: `/api/v1/properties/${ID}/soft-delete`,
    });
  });

  it("validates status and normalizes an empty deal_date to null", () => {
    expect(buildActionRequest(ID, "status", { status: "closed", deal_date: "" })).toEqual({
      ok: true,
      path: `/api/v1/properties/${ID}/status`,
      body: { status: "closed", deal_date: null },
    });
    expect(buildActionRequest(ID, "status", { status: "closed", deal_date: "2026-11-19" })).toEqual({
      ok: true,
      path: `/api/v1/properties/${ID}/status`,
      body: { status: "closed", deal_date: "2026-11-19" },
    });
    expect(buildActionRequest(ID, "status", { status: "deleted" }).ok).toBe(false);
    expect(buildActionRequest(ID, "status", { status: "closed", deal_date: "19/11/2026" }).ok).toBe(false);
    expect(buildActionRequest(ID, "status", null).ok).toBe(false);
  });

  it("validates share and reassign bodies and drops extra fields", () => {
    expect(buildActionRequest(ID, "share", { shared: true, evil: 1 })).toEqual({
      ok: true,
      path: `/api/v1/properties/${ID}/share`,
      body: { shared: true },
    });
    expect(buildActionRequest(ID, "share", { shared: "yes" }).ok).toBe(false);
    expect(buildActionRequest(ID, "reassign", { owner_user_id: OTHER })).toEqual({
      ok: true,
      path: `/api/v1/properties/${ID}/reassign`,
      body: { owner_user_id: OTHER },
    });
    expect(buildActionRequest(ID, "reassign", { owner_user_id: "x" }).ok).toBe(false);
  });
});

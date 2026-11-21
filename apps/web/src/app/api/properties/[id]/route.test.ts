import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

const getSessionToken = vi.fn();
vi.mock("@/lib/session", () => ({
  getSessionToken: () => getSessionToken(),
}));

import { PUT } from "./route";

const ID = "3f2b8c1e-5d4a-4b7e-9c1a-2e6f8a9b0c3d";
const OWNER = "7a1d4c2e-9b3f-4e5a-8c6d-1f2a3b4c5d6e";
const sameOrigin = { "sec-fetch-site": "same-origin" };

const validBody = {
  deal_type: "rent",
  city_id: 514,
  property_types: ["apartment"],
  amenities: [],
  custom_amenities: [],
  is_corner: false,
  is_urgent: false,
  ownership_dang: 6,
  convertible_options: [{ deposit: 100_000_000, monthly_rent: 5_000_000 }],
  version: 3,
};

function putRequest(body?: unknown, headers: Record<string, string> = sameOrigin) {
  return new Request(`http://app.test/api/properties/${ID}`, {
    method: "PUT",
    headers: {
      host: "app.test",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined
      ? { body: typeof body === "string" ? body : JSON.stringify(body) }
      : {}),
  });
}

const call = (req: Request, id = ID) => PUT(req, { params: Promise.resolve({ id }) });

describe("PUT /api/properties/[id]", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    getSessionToken.mockReset();
  });

  it("refuses cross-site requests without touching session or backend", async () => {
    const res = await call(putRequest(validBody, { "sec-fetch-site": "cross-site" }));
    expect(res.status).toBe(403);
    expect(getSessionToken).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("refuses requests with no origin information", async () => {
    const res = await call(putRequest(validBody, {}));
    expect(res.status).toBe(403);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON before authentication", async () => {
    const res = await call(putRequest("{invalid-json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_input");
    expect(getSessionToken).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("rejects an empty body, a missing version and a bad id before authentication", async () => {
    const empty = await call(putRequest());
    expect(empty.status).toBe(422);

    const { version: _omit, ...withoutVersion } = validBody;
    const noVersion = await call(putRequest(withoutVersion));
    expect(noVersion.status).toBe(422);

    const badId = await call(putRequest(validBody), "not-a-uuid");
    expect(badId.status).toBe(422);

    expect(getSessionToken).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("returns 401 without calling the backend when there is no session", async () => {
    getSessionToken.mockResolvedValue(null);
    const res = await call(putRequest(validBody));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("not_authenticated");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("sends a PUT with the token and the version, and returns the updated file", async () => {
    getSessionToken.mockResolvedValue("tok");
    apiFetch.mockResolvedValue({ ok: true, status: 200, data: { id: ID, version: 4 } });

    const res = await call(putRequest(validBody));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: ID, version: 4 });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    const [path, init] = apiFetch.mock.calls[0];
    expect(path).toBe(`/api/v1/properties/${ID}`);
    expect(init).toMatchObject({ method: "PUT", token: "tok" });
    expect(init.body).toMatchObject({ deal_type: "rent", city_id: 514, version: 3 });
    expect(init.body.convertible_options).toEqual(validBody.convertible_options);
  });

  it("never forwards owner_user_id to the backend", async () => {
    getSessionToken.mockResolvedValue("tok");
    apiFetch.mockResolvedValue({ ok: true, status: 200, data: {} });
    await call(putRequest({ ...validBody, owner_user_id: OWNER }));
    expect(apiFetch.mock.calls[0][1].body).not.toHaveProperty("owner_user_id");
  });

  it.each([
    [409, "version_conflict"],
    [403, "forbidden"],
    [404, "not_found"],
  ])("passes a %s backend error through unchanged", async (status, code) => {
    getSessionToken.mockResolvedValue("tok");
    apiFetch.mockResolvedValue({ ok: false, status, error: { code, message: "x" } });
    const res = await call(putRequest(validBody));
    expect(res.status).toBe(status);
    expect((await res.json()).error.code).toBe(code);
  });
});

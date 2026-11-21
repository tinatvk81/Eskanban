import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

const getSessionToken = vi.fn();
vi.mock("@/lib/session", () => ({
  getSessionToken: () => getSessionToken(),
}));

import { POST } from "./route";

const OWNER = "3f2b8c1e-5d4a-4b7e-9c1a-2f6d8e0a1b3c";
const sameOrigin = { "sec-fetch-site": "same-origin" };
const validBody = { deal_type: "sale", city_id: 12 };

function createRequest(body?: unknown, headers: Record<string, string> = sameOrigin) {
  return new Request("http://app.test/api/properties", {
    method: "POST",
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

describe("POST /api/properties", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    getSessionToken.mockReset();
  });

  it("refuses cross-site requests without touching session or backend", async () => {
    const res = await POST(createRequest(validBody, { "sec-fetch-site": "cross-site" }));

    expect(res.status).toBe(403);
    expect(getSessionToken).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("refuses requests with no origin information", async () => {
    const res = await POST(createRequest(validBody, {}));

    expect(res.status).toBe(403);
    expect(getSessionToken).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON before authentication", async () => {
    const res = await POST(createRequest("{invalid-json"));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_input");
    expect(getSessionToken).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("rejects an empty body before authentication", async () => {
    const res = await POST(createRequest());

    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("invalid_input");
    expect(getSessionToken).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid body before authentication", async () => {
    const res = await POST(createRequest({ deal_type: "sale" }));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_input");
    expect(body.error.message).toContain("city_id");
    expect(getSessionToken).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("returns 401 when there is no session", async () => {
    getSessionToken.mockResolvedValue(null);

    const res = await POST(createRequest(validBody));

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("not_authenticated");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("forwards only the validated fields and keeps the 201 status", async () => {
    getSessionToken.mockResolvedValue("tok");
    apiFetch.mockResolvedValue({ ok: true, status: 201, data: { id: "new-id", version: 1 } });

    const res = await POST(
      createRequest({ ...validBody, owner_user_id: OWNER, agency_id: "evil", version: 9 }),
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "new-id", version: 1 });
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/properties", {
      method: "POST",
      token: "tok",
      body: { ...validBody, owner_user_id: OWNER },
    });
  });

  const backendErrors: Array<[number, string]> = [
    [403, "forbidden"],
    [404, "user_not_found"],
    [503, "unavailable"],
  ];
  it.each(backendErrors)("relays a backend %i error (%s)", async (status, code) => {
    getSessionToken.mockResolvedValue("tok");
    apiFetch.mockResolvedValue({ ok: false, status, error: { code, message: "m" } });

    const res = await POST(createRequest(validBody));

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: { code, message: "m" } });
  });
});

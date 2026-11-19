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

const PROPERTY_ID = "123e4567-e89b-42d3-a456-426614174000";
const sameOrigin = { "sec-fetch-site": "same-origin" };

function actionRequest(
  action = "favorite",
  body?: unknown,
  headers: Record<string, string> = sameOrigin,
) {
  return new Request(
    `http://app.test/api/properties/${PROPERTY_ID}/${action}`,
    {
      method: "POST",
      headers: {
        host: "app.test",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      ...(body !== undefined
        ? { body: typeof body === "string" ? body : JSON.stringify(body) }
        : {}),
    },
  );
}

function routeParams(action = "favorite", id = PROPERTY_ID) {
  return { params: Promise.resolve({ id, action }) };
}

describe("POST /api/properties/[id]/[action]", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    getSessionToken.mockReset();
  });

  it("refuses cross-site requests without touching session or backend", async () => {
    const res = await POST(
      actionRequest("favorite", undefined, { "sec-fetch-site": "cross-site" }),
      routeParams(),
    );

    expect(res.status).toBe(403);
    expect(getSessionToken).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("refuses requests with no origin information", async () => {
    const res = await POST(actionRequest("favorite", undefined, {}), routeParams());

    expect(res.status).toBe(403);
    expect(getSessionToken).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const res = await POST(
      actionRequest("share", "{invalid-json"),
      routeParams("share"),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_input");
    expect(getSessionToken).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("rejects invalid property IDs and unknown actions before authentication", async () => {
    const invalidIdResponse = await POST(
      actionRequest(),
      routeParams("favorite", "not-a-uuid"),
    );

    expect(invalidIdResponse.status).toBe(404);
    expect((await invalidIdResponse.json()).error.code).toBe("property_not_found");

    const unknownActionResponse = await POST(
      actionRequest("unknown-action"),
      routeParams("unknown-action"),
    );

    expect(unknownActionResponse.status).toBe(404);
    expect((await unknownActionResponse.json()).error.code).toBe("not_found");

    expect(getSessionToken).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("rejects invalid action bodies before authentication", async () => {
    const res = await POST(
      actionRequest("share", { shared: "yes" }),
      routeParams("share"),
    );

    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("invalid_input");
    expect(getSessionToken).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("returns 401 when there is no session token", async () => {
    getSessionToken.mockResolvedValue(null);

    const res = await POST(actionRequest(), routeParams());

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("not_authenticated");
    expect(getSessionToken).toHaveBeenCalledOnce();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("forwards a valid favorite action to the backend", async () => {
    getSessionToken.mockResolvedValue("esk_test-token");
    apiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      retryAfter: null,
      data: { is_favorite: true },
    });

    const res = await POST(actionRequest(), routeParams());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ is_favorite: true });
    expect(apiFetch).toHaveBeenCalledWith(
      `/api/v1/properties/${PROPERTY_ID}/favorite`,
      {
        method: "POST",
        token: "esk_test-token",
        body: undefined,
      },
    );
  });

  it("forwards only validated fields for an action with a body", async () => {
    getSessionToken.mockResolvedValue("esk_test-token");
    apiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      retryAfter: null,
      data: { shared: true },
    });

    const res = await POST(
      actionRequest("share", { shared: true, unexpected: "ignored" }),
      routeParams("share"),
    );

    expect(res.status).toBe(200);
    expect(apiFetch).toHaveBeenCalledWith(
      `/api/v1/properties/${PROPERTY_ID}/share`,
      {
        method: "POST",
        token: "esk_test-token",
        body: { shared: true },
      },
    );
  });

  it("preserves backend error status and response", async () => {
    getSessionToken.mockResolvedValue("esk_test-token");
    apiFetch.mockResolvedValue({
      ok: false,
      status: 403,
      retryAfter: null,
      error: { code: "forbidden", message: "not allowed" },
    });

    const res = await POST(actionRequest(), routeParams());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: { code: "forbidden", message: "not allowed" },
    });
  });

  it("returns an empty response when the backend responds with 204", async () => {
    getSessionToken.mockResolvedValue("esk_test-token");
    apiFetch.mockResolvedValue({
      ok: true,
      status: 204,
      retryAfter: null,
      data: undefined,
    });

    const res = await POST(
      actionRequest("soft-delete"),
      routeParams("soft-delete"),
    );

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });
});

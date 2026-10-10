import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));

import { POST } from "./route";

function loginRequest(body: unknown, headers: Record<string, string> = { "sec-fetch-site": "same-origin" }) {
  return new Request("http://app.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", host: "app.test", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const goodLogin = {
  ok: true,
  status: 200,
  retryAfter: null,
  data: {
    access_token: "esk_secret-token-value",
    expires_at: "2026-10-16T00:00:00Z",
    must_change_password: false,
    user: { id: "u1", full_name: "Ali Rezaei", role: "manager" },
  },
};

describe("POST /api/auth/login", () => {
  beforeEach(() => apiFetch.mockReset());

  it("refuses cross-site requests without touching the backend", async () => {
    const res = await POST(loginRequest({ phone: "0912", password: "x" }, { "sec-fetch-site": "cross-site" }));
    expect(res.status).toBe(403);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("refuses requests with no origin information", async () => {
    const res = await POST(loginRequest({ phone: "0912", password: "x" }, {}));
    expect(res.status).toBe(403);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("rejects malformed bodies", async () => {
    expect((await POST(loginRequest("not json"))).status).toBe(400);
    expect((await POST(loginRequest({ phone: 123, password: "x" }))).status).toBe(400);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("stores the token only in an httpOnly cookie, never in the response body", async () => {
    apiFetch.mockResolvedValue(goodLogin);
    const res = await POST(loginRequest({ phone: "0912", password: "pw" }));
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).not.toContain("esk_secret-token-value");
    expect(JSON.parse(text)).toEqual({
      mustChangePassword: false,
      user: { fullName: "Ali Rezaei", role: "manager" },
    });

    const cookie = res.cookies.get("eskanban_session");
    expect(cookie?.value).toBe("esk_secret-token-value");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("passes backend errors and Retry-After through, without setting a cookie", async () => {
    apiFetch.mockResolvedValue({
      ok: false,
      status: 429,
      retryAfter: 900,
      error: { code: "account_locked", message: "locked" },
    });
    const res = await POST(loginRequest({ phone: "0912", password: "pw" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("900");
    expect((await res.json()).error.code).toBe("account_locked");
    expect(res.cookies.get("eskanban_session")).toBeUndefined();
  });

  it("forwards only phone and password to the backend", async () => {
    apiFetch.mockResolvedValue(goodLogin);
    await POST(loginRequest({ phone: "0912", password: "pw", extra: "ignored", admin: true }));
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/auth/login", {
      method: "POST",
      body: { phone: "0912", password: "pw" },
    });
  });
});

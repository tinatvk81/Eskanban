import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));
const getSessionToken = vi.fn();
vi.mock("@/lib/session", () => ({ getSessionToken: () => getSessionToken() }));

import { POST } from "./route";

const sameOrigin = { "sec-fetch-site": "same-origin" };
const req = (headers: Record<string, string> = sameOrigin) =>
  new Request("http://app.test/api/auth/logout", { method: "POST", headers: { host: "app.test", ...headers } });

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    getSessionToken.mockReset();
  });

  it("refuses cross-site requests", async () => {
    const res = await POST(req({ "sec-fetch-site": "cross-site" }));
    expect(res.status).toBe(403);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("revokes the session on the backend and clears the cookie", async () => {
    getSessionToken.mockResolvedValue("esk_abc");
    apiFetch.mockResolvedValue({ ok: true, status: 204, data: undefined, retryAfter: null });
    const res = await POST(req());
    expect(res.status).toBe(204);
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/auth/logout", { method: "POST", token: "esk_abc" });
    const cleared = res.cookies.get("eskanban_session");
    expect(cleared?.value).toBe("");
    expect(cleared?.maxAge).toBe(0);
  });

  it("still clears the cookie when the backend is down", async () => {
    getSessionToken.mockResolvedValue("esk_abc");
    apiFetch.mockResolvedValue({ ok: false, status: 503, retryAfter: null, error: { code: "unavailable", message: "x" } });
    const res = await POST(req());
    expect(res.status).toBe(204);
    expect(res.cookies.get("eskanban_session")?.maxAge).toBe(0);
  });

  it("works without a session cookie", async () => {
    getSessionToken.mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(204);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

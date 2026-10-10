import { describe, expect, it } from "vitest";
import { SESSION_MAX_AGE_SECONDS, sessionCookieOptions } from "./cookie";

describe("sessionCookieOptions", () => {
  it("is always httpOnly, lax, site-wide and capped at 30 days", () => {
    const o = sessionCookieOptions({ NODE_ENV: "development" });
    expect(o).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE_SECONDS });
    expect(SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 3600);
  });
  it("is Secure in production and not in development", () => {
    expect(sessionCookieOptions({ NODE_ENV: "production" }).secure).toBe(true);
    expect(sessionCookieOptions({ NODE_ENV: "development" }).secure).toBe(false);
  });
  it("COOKIE_SECURE=false lets a production build run over plain http locally", () => {
    expect(sessionCookieOptions({ NODE_ENV: "production", COOKIE_SECURE: "false" }).secure).toBe(false);
    expect(sessionCookieOptions({ NODE_ENV: "development", COOKIE_SECURE: "true" }).secure).toBe(true);
  });
});

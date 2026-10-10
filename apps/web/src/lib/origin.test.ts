import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./origin";

describe("isSameOrigin (CSRF defence)", () => {
  it("accepts same-origin fetches by Sec-Fetch-Site", () => {
    expect(isSameOrigin({ origin: null, host: "app.test", secFetchSite: "same-origin" })).toBe(true);
  });
  it("rejects cross-site and same-site-but-different-origin requests", () => {
    expect(isSameOrigin({ origin: "https://evil.test", host: "app.test", secFetchSite: "cross-site" })).toBe(false);
    expect(isSameOrigin({ origin: null, host: "app.test", secFetchSite: "same-site" })).toBe(false);
  });
  it("falls back to comparing Origin with Host", () => {
    expect(isSameOrigin({ origin: "https://app.test", host: "app.test", secFetchSite: null })).toBe(true);
    expect(isSameOrigin({ origin: "https://evil.test", host: "app.test", secFetchSite: null })).toBe(false);
  });
  it("rejects requests that say nothing about where they came from", () => {
    expect(isSameOrigin({ origin: null, host: "app.test", secFetchSite: null })).toBe(false);
  });
  it("rejects a malformed Origin", () => {
    expect(isSameOrigin({ origin: "not a url", host: "app.test", secFetchSite: null })).toBe(false);
  });
});

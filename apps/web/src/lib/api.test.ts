import { describe, expect, it } from "vitest";
import { parseRetryAfter } from "./api";

describe("parseRetryAfter", () => {
  it("parses whole seconds", () => expect(parseRetryAfter("900")).toBe(900));
  it("ignores missing or invalid values", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
    expect(parseRetryAfter("-5")).toBeNull();
  });
});

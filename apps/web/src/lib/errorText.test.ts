import { describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { fa } from "@/i18n/messages/fa";
import { errorText } from "./errorText";

describe("errorText", () => {
  it.each([
    ["invalid_credentials", "invalidCredentials"],
    ["weak_password", "weakPassword"],
    ["wrong_password", "wrongPassword"],
    ["unavailable", "unavailable"],
  ] as const)("maps %s", (code, key) => {
    expect(errorText(fa, code)).toBe(fa.errors[key]);
    expect(errorText(en, code)).toBe(en.errors[key]);
  });

  it("falls back to a generic message for unknown or missing codes", () => {
    expect(errorText(fa, "something_new")).toBe(fa.errors.generic);
    expect(errorText(en, undefined)).toBe(en.errors.generic);
  });

  it("rounds the lockout time up to whole minutes, at least one", () => {
    expect(errorText(en, "account_locked", 61)).toContain("2 minute");
    expect(errorText(en, "account_locked", 900)).toContain("15 minute");
    expect(errorText(en, "account_locked", 5)).toContain("1 minute");
    expect(errorText(fa, "account_locked", null)).toContain("1");
    expect(errorText(en, "account_locked", 61)).not.toContain("{minutes}");
  });

  it("has a complete message for every key in both languages", () => {
    for (const t of [fa, en]) {
      for (const value of Object.values(t.errors)) expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});

import { describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { fa } from "@/i18n/messages/fa";
import { errorText } from "./errorText";

describe("errorText: file action errors", () => {
  for (const [name, t] of [["fa", fa], ["en", en]] as const) {
    it(`maps action error codes (${name})`, () => {
      expect(errorText(t, "forbidden")).toBe(t.errors.forbidden);
      expect(errorText(t, "version_conflict")).toBe(t.errors.versionConflict);
      expect(errorText(t, "property_not_found")).toBe(t.errors.notFound);
      expect(errorText(t, "user_not_found")).toBe(t.errors.userNotFound);
      expect(errorText(t, "something_else")).toBe(t.errors.generic);
    });
  }
});

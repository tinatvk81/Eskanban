import { describe, expect, it } from "vitest";
import { formatToman, labelOf, normalizeDigits, toNumber } from "./format";

const en = { million: " million", billion: " billion", toman: " Toman" };
const fa = { million: " میلیون", billion: " میلیارد", toman: " تومان" };

describe("normalizeDigits", () => {
  it("converts Persian and Arabic-Indic digits", () => {
    expect(normalizeDigits("۰۹۱۲")).toBe("0912");
    expect(normalizeDigits("٠٩١٢")).toBe("0912");
  });
});

describe("formatToman", () => {
  it("uses billions, millions and plain numbers", () => {
    expect(formatToman(5_200_000_000, "en", en)).toBe("5.2 billion Toman");
    expect(formatToman(450_000_000, "en", en)).toBe("450 million Toman");
    expect(formatToman(950_000, "en", en)).toBe("950,000 Toman");
  });
  it("shows a dash for missing values", () => expect(formatToman(null, "en", en)).toBe("—"));
  it("uses Persian wording in fa", () => {
    expect(formatToman(3_000_000_000, "fa", fa)).toContain("میلیارد");
  });
});

describe("toNumber / labelOf", () => {
  it("parses numbers and numeric strings", () => {
    expect(toNumber("120.5")).toBe(120.5);
    expect(toNumber(null)).toBeNull();
    expect(toNumber("abc")).toBeNull();
  });
  it("falls back to the key when a label is missing", () => {
    expect(labelOf([{ key: "sale", fa: "فروش", en: "Sale" }], "sale", "fa")).toBe("فروش");
    expect(labelOf(undefined, "sale", "en")).toBe("sale");
  });
});
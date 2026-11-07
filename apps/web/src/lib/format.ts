import type { Locale } from "@/i18n/config";
import type { VocabItem } from "./propertyTypes";

export type MoneyUnits = { million: string; billion: string; toman: string };

const tag = (locale: Locale) => (locale === "fa" ? "fa-IR" : "en-US");

/** Persian (۰-۹) and Arabic-Indic (٠-٩) digits -> ASCII digits. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

export function formatNumber(value: number, locale: Locale, maxFraction = 2): string {
  return new Intl.NumberFormat(tag(locale), { maximumFractionDigits: maxFraction }).format(value);
}

export function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Whole Toman -> "5.2 billion Toman" / "۵٫۲ میلیارد تومان". Units carry their own leading space. */
export function formatToman(
  value: number | null | undefined,
  locale: Locale,
  units: MoneyUnits,
): string {
  if (value === null || value === undefined) return "—";
  if (value >= 1_000_000_000) {
    return `${formatNumber(value / 1_000_000_000, locale)}${units.billion}${units.toman}`;
  }
  if (value >= 1_000_000) {
    return `${formatNumber(value / 1_000_000, locale)}${units.million}${units.toman}`;
  }
  return `${formatNumber(value, locale, 0)}${units.toman}`;
}

export function formatArea(
  value: number | string | null | undefined,
  locale: Locale,
  unit: string,
): string {
  const n = toNumber(value);
  return n === null ? "—" : `${formatNumber(n, locale, 1)}${unit}`;
}

export function labelOf(items: VocabItem[] | undefined, key: string, locale: Locale): string {
  const item = items?.find((i) => i.key === key);
  return item?.[locale] || key;
}
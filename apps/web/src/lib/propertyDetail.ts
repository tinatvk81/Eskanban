import type { Locale } from "@/i18n/config";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const tag = (locale: Locale) => (locale === "fa" ? "fa-IR" : "en-US");

/** Route ids must look like UUIDs before they reach the API path. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Date-only values are shown as-is (UTC); timestamps are shown in Tehran time. */
export function formatDate(value: string | null | undefined, locale: Locale): string | null {
  if (!value) return null;
  const dateOnly = DATE_ONLY.test(value);
  const d = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(tag(locale), {
    dateStyle: "medium",
    timeZone: dateOnly ? "UTC" : "Asia/Tehran",
  }).format(d);
}

export function formatDateTime(value: string | null | undefined, locale: Locale): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(tag(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  }).format(d);
}

/** Whole numbers without thousands separators (floor, year, rooms). */
export function formatPlain(value: number | null | undefined, locale: Locale): string | null {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat(tag(locale), { useGrouping: false, maximumFractionDigits: 0 }).format(value);
}

/** Only http(s) links are rendered as links. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export function telHref(value: string | null | undefined): string | null {
  if (!value) return null;
  const ascii = value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const cleaned = ascii.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}

const MAX = 120;
const PAIRS: Array<[string, string]> = [
  ["old", "new"],
  ["from", "to"],
  ["before", "after"],
];

function clip(s: string): string {
  return s.length > MAX ? `${s.slice(0, MAX)}…` : s;
}

function scalar(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") return clip(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return clip(v.map(scalar).join(", "));
  return clip(JSON.stringify(v));
}

/** Short, safe text for one entry of a history `changes` object (shape is not guaranteed). */
export function describeChange(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    for (const [a, b] of PAIRS) {
      if (a in rec && b in rec) return `${scalar(rec[a])} → ${scalar(rec[b])}`;
    }
  }
  return scalar(value);
}

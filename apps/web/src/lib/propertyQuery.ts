import { normalizeDigits } from "./format";

export const DEAL_TYPES = ["sale", "presale", "rent", "mortgage"] as const;
export const STATUSES = ["active", "inactive", "closed", "any"] as const;
export const SORTS = [
  "created_at:desc",
  "updated_at:desc",
  "price:asc",
  "price:desc",
  "area:desc",
  "area:asc",
  "contract_end_date:asc",
] as const;

type RawParams = Record<string, string | string[] | undefined>;

export type FileFilters = {
  q: string;
  status: string;
  deal: string;
  type: string;
  pmin: string; // million Toman
  pmax: string;
  amin: string; // m2
  amax: string;
  rmin: string;
  rmax: string;
  urgent: boolean;
  fav: boolean;
  sort: string;
  page: number;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const oneOf = (list: readonly string[], v: string | undefined) => (v && list.includes(v) ? v : undefined);

/** Digits only (Persian digits and separators accepted); "" when invalid or too long. */
export function digits(value: string | undefined, maxLen: number): string {
  if (!value) return "";
  const cleaned = normalizeDigits(value).replace(/[\s,،٬]/g, "");
  return /^\d+$/.test(cleaned) && cleaned.length <= maxLen ? cleaned : "";
}

export function parseFilters(raw: RawParams): FileFilters {
  const type = first(raw.type) ?? "";
  return {
    q: (first(raw.q) ?? "").trim().slice(0, 100),
    status: oneOf(STATUSES, first(raw.status)) ?? "active",
    deal: oneOf(DEAL_TYPES, first(raw.deal)) ?? "",
    type: /^[a-z_]{1,40}$/.test(type) ? type : "",
    pmin: digits(first(raw.pmin), 9),
    pmax: digits(first(raw.pmax), 9),
    amin: digits(first(raw.amin), 6),
    amax: digits(first(raw.amax), 6),
    rmin: digits(first(raw.rmin), 3),
    rmax: digits(first(raw.rmax), 3),
    urgent: first(raw.urgent) === "1",
    fav: first(raw.fav) === "1",
    sort: oneOf(SORTS, first(raw.sort)) ?? "created_at:desc",
    page: Math.max(1, Number.parseInt(digits(first(raw.page), 6) || "1", 10)),
  };
}

/** Query string for the FastAPI endpoint (prices converted from million Toman to Toman). */
export function buildApiQuery(f: FileFilters): string {
  const p = new URLSearchParams();
  p.set("status", f.status);
  if (f.q) p.set("search", f.q);
  if (f.deal) p.append("deal_type", f.deal);
  if (f.type) p.append("property_type", f.type);
  const toman = (v: string) => String(Number(v) * 1_000_000);
  if (f.pmin) p.set("min_price", toman(f.pmin));
  if (f.pmax) p.set("max_price", toman(f.pmax));
  if (f.amin) p.set("min_area", f.amin);
  if (f.amax) p.set("max_area", f.amax);
  if (f.rmin) p.set("min_rooms", f.rmin);
  if (f.rmax) p.set("max_rooms", f.rmax);
  if (f.urgent) p.set("urgent_only", "true");
  if (f.fav) p.set("favorites_only", "true");
  const [sortBy, order] = f.sort.split(":");
  p.set("sort_by", sortBy);
  p.set("order", order);
  p.set("page", String(f.page));
  return p.toString();
}

/** Query string for the page URL: only non-default values, so links stay short. */
export function uiQuery(f: FileFilters, page: number = f.page): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.status !== "active") p.set("status", f.status);
  if (f.deal) p.set("deal", f.deal);
  if (f.type) p.set("type", f.type);
  if (f.pmin) p.set("pmin", f.pmin);
  if (f.pmax) p.set("pmax", f.pmax);
  if (f.amin) p.set("amin", f.amin);
  if (f.amax) p.set("amax", f.amax);
  if (f.rmin) p.set("rmin", f.rmin);
  if (f.rmax) p.set("rmax", f.rmax);
  if (f.urgent) p.set("urgent", "1");
  if (f.fav) p.set("fav", "1");
  if (f.sort !== "created_at:desc") p.set("sort", f.sort);
  if (page > 1) p.set("page", String(page));
  return p.toString();
}
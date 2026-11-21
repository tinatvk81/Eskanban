/**
 * Pure helpers that turn the create-form state (everything the user typed is a string) into the
 * JSON body of POST /api/properties. Persian/Arabic digits and thousands separators are accepted.
 * Empty optional fields are left out so the backend defaults apply. Vocabulary keys are not checked
 * here: the backend is the authority on them.
 */

export type FieldError = "required" | "invalid" | "range" | "date" | "url";

export type FormValues = {
  deal_type: string;
  property_types: string[];
  city_id: string;
  district: string;
  address: string;
  location_url: string;
  land_area_m2: string;
  built_area_m2: string;
  rooms: string;
  floor: string;
  total_floors: string;
  total_units: string;
  build_year: string;
  direction: string;
  is_corner: boolean;
  amenities: string[];
  custom_amenities: string; // one per line, or separated by "," / "،"
  document_type: string;
  document_note: string;
  ownership_dang: string;
  is_divided: string; // "" (unknown) | "yes" | "no"
  deed_scope: string;
  ownership_kind: string;
  occupancy: string;
  vacate_date: string;
  owner_name: string;
  owner_phone: string;
  price_total: string;
  price_per_m2: string;
  deposit: string;
  monthly_rent: string;
  price_note: string;
  payment_terms: string;
  contract_end_date: string;
  delivery_date: string;
  is_urgent: boolean;
  urgent_until: string;
  notes: string;
  owner_user_id: string;
};

export type FormErrors = Partial<Record<keyof FormValues, FieldError>>;

export type CreatePayloadResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; errors: FormErrors };

export const EMPTY_FORM: FormValues = {
  deal_type: "",
  property_types: [],
  city_id: "",
  district: "",
  address: "",
  location_url: "",
  land_area_m2: "",
  built_area_m2: "",
  rooms: "",
  floor: "",
  total_floors: "",
  total_units: "",
  build_year: "",
  direction: "",
  is_corner: false,
  amenities: [],
  custom_amenities: "",
  document_type: "",
  document_note: "",
  ownership_dang: "6",
  is_divided: "",
  deed_scope: "",
  ownership_kind: "",
  occupancy: "",
  vacate_date: "",
  owner_name: "",
  owner_phone: "",
  price_total: "",
  price_per_m2: "",
  deposit: "",
  monthly_rent: "",
  price_note: "",
  payment_terms: "",
  contract_end_date: "",
  delivery_date: "",
  is_urgent: false,
  urgent_until: "",
  notes: "",
  owner_user_id: "",
};

type Parsed<T> = { ok: true; value: T } | { ok: false; error: FieldError };

const MAX_MONEY = 10 ** 13;

/** Persian (۰-۹) and Arabic-Indic (٠-٩) digits become ASCII digits. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660));
}

// Digits normalised; spaces, thousands separators and bidi marks removed; "٫" becomes ".".
function compact(input: string): string {
  return normalizeDigits(input)
    .replace(/[\s,\u060C\u066C\u200C\u200E\u200F]/g, "")
    .replace(/\u066B/g, ".");
}

export function parseInteger(input: string, min: number, max: number): Parsed<number | null> {
  const text = compact(input);
  if (text === "") return { ok: true, value: null };
  if (!/^-?\d+$/.test(text)) return { ok: false, error: "invalid" };
  const value = Number(text);
  if (!Number.isSafeInteger(value)) return { ok: false, error: "invalid" };
  if (value < min || value > max) return { ok: false, error: "range" };
  return { ok: true, value };
}

/** Non-negative decimal with a limited number of fraction digits (min must be >= 0). */
export function parseDecimal(
  input: string,
  min: number,
  max: number,
  places = 2,
): Parsed<number | null> {
  const text = compact(input);
  if (text === "") return { ok: true, value: null };
  if (!/^\d+(\.\d+)?$/.test(text)) return { ok: false, error: "invalid" };
  const fraction = text.split(".")[1] ?? "";
  if (fraction.length > places) return { ok: false, error: "invalid" };
  const value = Number(text);
  if (value < min || value > max) return { ok: false, error: "range" };
  return { ok: true, value };
}

/** Accepts only a real calendar date written as YYYY-MM-DD (Gregorian). */
export function parseDate(input: string): Parsed<string | null> {
  const text = normalizeDigits(input).trim();
  if (text === "") return { ok: true, value: null };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return { ok: false, error: "date" };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  const real =
    check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
  return real ? { ok: true, value: text } : { ok: false, error: "date" };
}

export function buildCreatePayload(values: FormValues): CreatePayloadResult {
  const errors: FormErrors = {};
  const body: Record<string, unknown> = {};

  const put = <T>(key: keyof FormValues, parsed: Parsed<T | null>) => {
    if (!parsed.ok) errors[key] = parsed.error;
    else if (parsed.value !== null) body[key] = parsed.value;
  };
  const putText = (key: keyof FormValues, raw: string) => {
    const value = raw.trim();
    if (value !== "") body[key] = value;
  };

  const dealType = values.deal_type.trim();
  if (dealType === "") errors.deal_type = "required";
  else body.deal_type = dealType;

  const city = parseInteger(values.city_id, 1, Number.MAX_SAFE_INTEGER);
  if (!city.ok) errors.city_id = city.error;
  else if (city.value === null) errors.city_id = "required";
  else body.city_id = city.value;

  body.property_types = [...values.property_types];
  putText("district", values.district);
  putText("address", values.address);

  const link = values.location_url.trim();
  if (link !== "") {
    if (/^https?:\/\//i.test(link)) body.location_url = link;
    else errors.location_url = "url";
  }

  put("land_area_m2", parseDecimal(values.land_area_m2, 0, 1_000_000));
  put("built_area_m2", parseDecimal(values.built_area_m2, 0, 1_000_000));
  put("rooms", parseInteger(values.rooms, 0, 100));
  put("floor", parseInteger(values.floor, -10, 200));
  put("total_floors", parseInteger(values.total_floors, 0, 200));
  put("total_units", parseInteger(values.total_units, 0, 2000));
  put("build_year", parseInteger(values.build_year, 1200, 1600));
  putText("direction", values.direction);
  body.is_corner = values.is_corner;
  body.amenities = [...values.amenities];
  body.custom_amenities = values.custom_amenities
    .split(/[\n\r,\u060C]+/)
    .map((item) => item.trim())
    .filter((item) => item !== "");

  putText("document_type", values.document_type);
  putText("document_note", values.document_note);
  put("ownership_dang", parseInteger(values.ownership_dang, 1, 6));
  if (values.is_divided === "yes") body.is_divided = true;
  else if (values.is_divided === "no") body.is_divided = false;
  putText("deed_scope", values.deed_scope);
  putText("ownership_kind", values.ownership_kind);
  putText("occupancy", values.occupancy);
  put("vacate_date", parseDate(values.vacate_date));

  putText("owner_name", values.owner_name);
  putText("owner_phone", normalizeDigits(values.owner_phone));

  put("price_total", parseInteger(values.price_total, 0, MAX_MONEY));
  put("price_per_m2", parseInteger(values.price_per_m2, 0, MAX_MONEY));
  put("deposit", parseInteger(values.deposit, 0, MAX_MONEY));
  put("monthly_rent", parseInteger(values.monthly_rent, 0, MAX_MONEY));
  putText("price_note", values.price_note);
  putText("payment_terms", values.payment_terms);

  put("contract_end_date", parseDate(values.contract_end_date));
  put("delivery_date", parseDate(values.delivery_date));
  body.is_urgent = values.is_urgent;
  if (values.is_urgent) put("urgent_until", parseDate(values.urgent_until));
  putText("notes", values.notes);
  putText("owner_user_id", values.owner_user_id);

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, body };
}

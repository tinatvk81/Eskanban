import { isUuid } from "./propertyDetail";

export type CreateRequest =
  | { ok: true; path: string; body: Record<string, unknown> }
  | { ok: false; status: number; code: string; message: string };

type Check = (v: unknown) => boolean;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MONEY = 10 ** 13;
const MAX_CONVERTIBLE_OPTIONS = 10;

const invalid = (message: string): CreateRequest => ({
  ok: false,
  status: 422,
  code: "invalid_input",
  message,
});
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str =
  (max: number): Check =>
  (v) =>
    typeof v === "string" && v.length <= max;
const int =
  (min: number, max: number): Check =>
  (v) =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
const num =
  (min: number, max: number): Check =>
  (v) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const bool: Check = (v) => typeof v === "boolean";
const date: Check = (v) => typeof v === "string" && DATE_ONLY.test(v);
const list =
  (maxItems: number, maxLen: number): Check =>
  (v) =>
    Array.isArray(v) &&
    v.length <= maxItems &&
    v.every((i) => typeof i === "string" && i.length <= maxLen);
const money = int(0, MAX_MONEY);

// Optional fields; null means "not set". Vocabulary keys are checked by the backend only.
const NULLABLE: Record<string, Check> = {
  district: str(80),
  address: str(255),
  location_url: str(500),
  land_area_m2: num(0, 1_000_000),
  built_area_m2: num(0, 1_000_000),
  rooms: int(0, 100),
  floor: int(-10, 200),
  total_floors: int(0, 200),
  total_units: int(0, 2000),
  build_year: int(1200, 1600),
  direction: str(64),
  document_type: str(64),
  document_note: str(200),
  deed_scope: str(64),
  ownership_kind: str(64),
  occupancy: str(64),
  is_divided: bool,
  vacate_date: date,
  owner_name: str(120),
  owner_phone: str(32),
  price_total: money,
  price_per_m2: money,
  deposit: money,
  monthly_rent: money,
  price_note: str(500),
  contract_end_date: date,
  delivery_date: date,
  payment_terms: str(1000),
  urgent_until: date,
  notes: str(2000),
};

// Fields that have a default on the backend and must not be null when sent.
const NON_NULL: Record<string, Check> = {
  property_types: list(13, 64),
  amenities: list(40, 64),
  custom_amenities: list(20, 120),
  is_corner: bool,
  is_urgent: bool,
  ownership_dang: int(1, 6),
};

/**
 * Turns the browser's create request into the exact backend call. Only known fields are forwarded
 * (never agency_id, id, version or status), types and ranges are checked, and the backend stays
 * the authority on vocabularies, ownership rules and permissions.
 */
export function buildCreateRequest(raw: unknown): CreateRequest {
  if (!isRecord(raw)) return invalid("request body must be a JSON object");
  const body: Record<string, unknown> = {};

  if (typeof raw.deal_type !== "string" || raw.deal_type === "") return invalid("invalid deal_type");
  body.deal_type = raw.deal_type;

  if (typeof raw.city_id !== "number" || !Number.isSafeInteger(raw.city_id) || raw.city_id < 1) {
    return invalid("invalid city_id");
  }
  body.city_id = raw.city_id;

  for (const [key, check] of Object.entries(NULLABLE)) {
    const value = raw[key];
    if (value === undefined) continue;
    if (value !== null && !check(value)) return invalid(`invalid ${key}`);
    body[key] = value;
  }

  for (const [key, check] of Object.entries(NON_NULL)) {
    const value = raw[key];
    if (value === undefined) continue;
    if (!check(value)) return invalid(`invalid ${key}`);
    body[key] = value;
  }

  const options = raw.convertible_options;
  if (options !== undefined) {
    if (!Array.isArray(options) || options.length > MAX_CONVERTIBLE_OPTIONS) {
      return invalid("invalid convertible_options");
    }
    const clean: Array<{ deposit: unknown; monthly_rent: unknown }> = [];
    for (const option of options) {
      if (!isRecord(option) || !money(option.deposit) || !money(option.monthly_rent)) {
        return invalid("invalid convertible_options");
      }
      clean.push({ deposit: option.deposit, monthly_rent: option.monthly_rent });
    }
    body.convertible_options = clean;
  }

  const owner = raw.owner_user_id;
  if (owner !== undefined && owner !== null) {
    if (typeof owner !== "string" || !isUuid(owner)) return invalid("invalid owner_user_id");
    body.owner_user_id = owner;
  }

  return { ok: true, path: "/api/v1/properties", body };
}


// PUT replaces the whole file: a field that is left out is reset to its default by the backend.
// So the update request must carry these fields explicitly and is rejected otherwise.
const UPDATE_REQUIRED = [
  "property_types",
  "amenities",
  "custom_amenities",
  "is_corner",
  "is_urgent",
  "ownership_dang",
  "convertible_options",
] as const;

/**
 * Turns the browser's edit request into the exact backend PUT call. It reuses the create checks,
 * requires `version` (the version the client read), ignores owner_user_id (reassigning is a
 * separate action) and refuses a request that would silently reset a defaulted field.
 */
export function buildUpdateRequest(id: string, raw: unknown): CreateRequest {
  if (!isUuid(id)) return invalid("invalid id");
  if (!isRecord(raw)) return invalid("request body must be a JSON object");

  const version = raw.version;
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) {
    return invalid("invalid version");
  }
  for (const key of UPDATE_REQUIRED) {
    if (raw[key] === undefined) return invalid(`missing ${key}`);
  }

  const rest: Record<string, unknown> = { ...raw };
  delete rest.owner_user_id;
  delete rest.version;

  const built = buildCreateRequest(rest);
  if (!built.ok) return built;
  return { ok: true, path: `/api/v1/properties/${id}`, body: { ...built.body, version } };
}

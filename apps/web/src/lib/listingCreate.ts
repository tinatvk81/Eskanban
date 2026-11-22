export type CreateRequest =
  | { ok: true; path: string; body: Record<string, unknown> }
  | { ok: false; status: number; code: string; message: string };

const invalid = (message: string): CreateRequest => ({
  ok: false,
  status: 422,
  code: "invalid_input",
  message,
});
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str =
  (max: number) =>
  (v: unknown): boolean =>
    typeof v === "string" && v.length <= max;
const int =
  (min: number, max: number) =>
  (v: unknown): boolean =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
const MAX_MONEY = 10 ** 13;
const money = int(0, MAX_MONEY);

// Mirrors AddFromLinkIn (app/schemas/listings.py). Only `url` is required; the advisor
// supplies whatever the source page shows right now — a connector fills this automatically later.
const NULLABLE: Record<string, (v: unknown) => boolean> = {
  title: str(255),
  owner_name: str(120),
  owner_phone: str(32),
  address: str(255),
  city_id: int(1, 100000),
  district: str(80),
  deal_type: str(20),
  price_total: money,
  deposit: money,
  monthly_rent: money,
};

export function buildAddFromLinkRequest(raw: unknown): CreateRequest {
  if (!isRecord(raw)) return invalid("invalid body");
  const url = raw.url;
  if (typeof url !== "string" || url.length === 0 || url.length > 500) {
    return invalid("invalid url");
  }

  const body: Record<string, unknown> = { url };
  for (const [key, check] of Object.entries(NULLABLE)) {
    const value = raw[key];
    if (value === undefined || value === null || value === "") continue;
    if (!check(value)) return invalid(`invalid ${key}`);
    body[key] = value;
  }

  if (raw.property_types !== undefined) {
    const types = raw.property_types;
    if (
      !Array.isArray(types) ||
      types.length > 13 ||
      !types.every((t) => typeof t === "string" && t.length <= 30)
    ) {
      return invalid("invalid property_types");
    }
    body.property_types = types;
  }

  return { ok: true, path: "/api/v1/listings/from-link", body };
}

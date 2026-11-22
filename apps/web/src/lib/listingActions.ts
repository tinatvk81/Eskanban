export type ActionRequest =
  | { ok: true; path: string; body?: unknown }
  | { ok: false; status: number; code: string; message: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);

const fail = (status: number, code: string, message: string): ActionRequest => ({
  ok: false,
  status,
  code,
  message,
});
const invalid = (message: string) => fail(422, "invalid_input", message);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// Every other PropertyFields field has a backend default, so a convert only NEEDS
// deal_type and city_id. Anything else the advisor fills becomes an override.
const DEAL_TYPES = ["sale", "presale", "rent", "mortgage"];

export function buildListingActionRequest(
  id: string,
  action: string,
  raw: unknown,
): ActionRequest {
  if (!isUuid(id)) return fail(404, "listing_not_found", "listing not found");
  const base = `/api/v1/listings/${id}`;

  switch (action) {
    case "dismiss":
      return { ok: true, path: `${base}/dismiss` };

    case "convert": {
      const body = isRecord(raw) ? raw : {};
      const dealType = body.deal_type;
      if (typeof dealType !== "string" || !DEAL_TYPES.includes(dealType)) {
        return invalid("invalid deal_type");
      }
      const cityId = body.city_id;
      if (typeof cityId !== "number" || !Number.isSafeInteger(cityId) || cityId <= 0) {
        return invalid("invalid city_id");
      }
      // Everything else is optional; forwarded as-is and validated by the backend schema.
      return { ok: true, path: `${base}/convert`, body: { ...body, deal_type: dealType, city_id: cityId } };
    }

    default:
      return fail(404, "not_found", "unknown action");
  }
}

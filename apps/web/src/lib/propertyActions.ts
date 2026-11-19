import { isUuid } from "./propertyDetail";

export type ActionRequest =
  | { ok: true; path: string; body?: unknown }
  | { ok: false; status: number; code: string; message: string };

const STATUSES = ["active", "inactive", "closed"];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const fail = (status: number, code: string, message: string): ActionRequest => ({
  ok: false,
  status,
  code,
  message,
});
const invalid = (message: string) => fail(422, "invalid_input", message);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Turns a browser request into the exact backend call. Only the five known actions exist and
 * only known fields are forwarded; the backend stays the real authority on permissions.
 */
export function buildActionRequest(id: string, action: string, raw: unknown): ActionRequest {
  if (!isUuid(id)) return fail(404, "property_not_found", "file not found");
  const base = `/api/v1/properties/${id}`;
  const body = isRecord(raw) ? raw : {};

  switch (action) {
    case "favorite":
      return { ok: true, path: `${base}/favorite` };
    case "soft-delete":
      return { ok: true, path: `${base}/soft-delete` };
    case "status": {
      const status = body.status;
      if (typeof status !== "string" || !STATUSES.includes(status)) return invalid("invalid status");
      const date = body.deal_date;
      if (date === undefined || date === null || date === "") {
        return { ok: true, path: `${base}/status`, body: { status, deal_date: null } };
      }
      if (typeof date !== "string" || !DATE_ONLY.test(date)) return invalid("invalid deal_date");
      return { ok: true, path: `${base}/status`, body: { status, deal_date: date } };
    }
    case "share": {
      if (typeof body.shared !== "boolean") return invalid("invalid shared");
      return { ok: true, path: `${base}/share`, body: { shared: body.shared } };
    }
    case "reassign": {
      const owner = body.owner_user_id;
      if (typeof owner !== "string" || !isUuid(owner)) return invalid("invalid owner_user_id");
      return { ok: true, path: `${base}/reassign`, body: { owner_user_id: owner } };
    }
    default:
      return fail(404, "not_found", "unknown action");
  }
}

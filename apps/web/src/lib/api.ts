import "server-only";

import type { ApiErrorBody } from "./types";

/** Server-side base URL of the FastAPI backend. Never exposed to the browser. */
export function apiBaseUrl(): string {
  return (process.env.API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T; retryAfter: number | null }
  | { ok: false; status: number; error: ApiErrorBody["error"]; retryAfter: number | null };

type Options = { method?: "GET" | "POST"; token?: string; body?: unknown };

export function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number.parseInt(value, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/** Calls the backend. Never throws: network problems become a 503 "unavailable" result. */
export async function apiFetch<T>(path: string, options: Options = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return {
      ok: false,
      status: 503,
      error: { code: "unavailable", message: "backend unavailable" },
      retryAfter: null,
    };
  }

  const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
  if (response.status === 204) {
    return { ok: true, status: 204, data: undefined as T, retryAfter };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    /* non-JSON body: fall through to the generic error below */
  }

  if (response.ok) {
    return { ok: true, status: response.status, data: payload as T, retryAfter };
  }
  const error = (payload as Partial<ApiErrorBody> | null)?.error;
  return {
    ok: false,
    status: response.status,
    error: error ?? { code: "error", message: `request failed (${response.status})` },
    retryAfter,
  };
}

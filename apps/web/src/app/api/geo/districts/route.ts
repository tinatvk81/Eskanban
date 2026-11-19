
import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/cookie";
import { getSessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = await getSessionToken();

  if (!token) {
    return NextResponse.json(
      { error: { code: "not_authenticated", message: "login required" } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

    const params = request.nextUrl.searchParams;

  const cityId = Number(params.get("city_id"));
  const q = (params.get("q") ?? "").trim().slice(0, 80);

  if (!Number.isSafeInteger(cityId) || cityId < 1) {
    return NextResponse.json(
      { error: { code: "invalid_input", message: "valid city_id is required" } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(params.get("limit") ?? "20", 10) || 20),
  );

  const offset = Math.min(
    1_000_000,
    Math.max(0, Number.parseInt(params.get("offset") ?? "0", 10) || 0),
  );

  const query = new URLSearchParams({
    city_id: String(cityId),
    limit: String(limit),
    offset: String(offset),
  });

  if (q) query.set("q", q);

  const result = await apiFetch<string[]>(
    `/api/v1/geo/districts?${query.toString()}`,
    { token },
  );

  if (result.ok) {
    return NextResponse.json(result.data, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const response = NextResponse.json(
    { error: result.error },
    { status: result.status, headers: { "Cache-Control": "no-store" } },
  );

  if (result.status === 401) {
    response.cookies.set(SESSION_COOKIE, "", {
      ...sessionCookieOptions(process.env),
      maxAge: 0,
    });
  }

  if (result.retryAfter !== null) {
    response.headers.set("Retry-After", String(result.retryAfter));
  }

  return response;
}

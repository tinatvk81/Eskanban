import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/cookie";
import { getSessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

type City = {
  id: number;
  name: string;
  province_id: number;
  province_name: string;
};

type RouteContext = {
  params: Promise<{ cityId: string }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const token = await getSessionToken();

  if (!token) {
    return NextResponse.json(
      { error: { code: "not_authenticated", message: "login required" } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { cityId: rawCityId } = await context.params;
  const cityId = Number(rawCityId);

  if (!Number.isSafeInteger(cityId) || cityId < 1) {
    return NextResponse.json(
      { error: { code: "invalid_input", message: "valid city id is required" } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await apiFetch<City>(
    `/api/v1/geo/cities/${cityId}`,
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
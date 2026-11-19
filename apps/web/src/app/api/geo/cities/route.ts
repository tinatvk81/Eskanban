
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

export async function GET(request: NextRequest) {
  const token = await getSessionToken();

  if (!token) {
    return NextResponse.json(
      { error: { code: "not_authenticated", message: "login required" } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const params = request.nextUrl.searchParams;

  const q = (params.get("q") ?? "").trim().slice(0, 80);

  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(params.get("limit") ?? "30", 10) || 30),
  );

  const offset = Math.min(
    1_000_000,
    Math.max(0, Number.parseInt(params.get("offset") ?? "0", 10) || 0),
  );

  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  if (q) query.set("q", q);

  const result = await apiFetch<City[]>(
    `/api/v1/geo/cities?${query.toString()}`,
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

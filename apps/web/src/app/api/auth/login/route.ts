import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/cookie";
import { isSameOrigin, originHeadersFrom } from "@/lib/origin";
import type { LoginResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(originHeadersFrom(request))) {
    return NextResponse.json({ error: { code: "forbidden", message: "bad origin" } }, { status: 403 });
  }

  let body: { phone?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "invalid_input", message: "bad request" } }, { status: 400 });
  }
  if (typeof body.phone !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: { code: "invalid_input", message: "bad request" } }, { status: 400 });
  }

  const result = await apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: { phone: body.phone, password: body.password },
  });

  if (!result.ok) {
    const response = NextResponse.json({ error: result.error }, { status: result.status });
    if (result.retryAfter !== null) response.headers.set("Retry-After", String(result.retryAfter));
    return response;
  }

  // The token only ever travels server-to-server and into this httpOnly cookie.
  const response = NextResponse.json({
    mustChangePassword: result.data.must_change_password,
    user: { fullName: result.data.user.full_name, role: result.data.user.role },
  });
  response.cookies.set(SESSION_COOKIE, result.data.access_token, sessionCookieOptions(process.env));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/cookie";
import { isSameOrigin, originHeadersFrom } from "@/lib/origin";
import { getSessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(originHeadersFrom(request))) {
    return NextResponse.json({ error: { code: "forbidden", message: "bad origin" } }, { status: 403 });
  }
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: { code: "not_authenticated", message: "login required" } }, { status: 401 });
  }

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "invalid_input", message: "bad request" } }, { status: 400 });
  }
  if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") {
    return NextResponse.json({ error: { code: "invalid_input", message: "bad request" } }, { status: 400 });
  }

  const result = await apiFetch("/api/v1/auth/change-password", {
    method: "POST",
    token,
    body: { current_password: body.currentPassword, new_password: body.newPassword },
  });

  if (result.ok) return new NextResponse(null, { status: 204 });

  const response = NextResponse.json({ error: result.error }, { status: result.status });
  if (result.status === 401) {
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(process.env), maxAge: 0 });
  }
  if (result.retryAfter !== null) response.headers.set("Retry-After", String(result.retryAfter));
  return response;
}

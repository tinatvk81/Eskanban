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
  if (token) {
    // Best effort: even if the backend is down, the browser is logged out locally.
    await apiFetch("/api/v1/auth/logout", { method: "POST", token });
  }
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(process.env), maxAge: 0 });
  return response;
}

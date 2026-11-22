import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";
import { buildListingActionRequest } from "@/lib/listingActions";
import { isSameOrigin, originHeadersFrom } from "@/lib/origin";
import { getSessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

const fail = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  if (!isSameOrigin(originHeadersFrom(request))) return fail(403, "forbidden", "bad origin");

  const { id, action } = await params;

  let raw: unknown = null;
  const text = await request.text();
  if (text) {
    try {
      raw = JSON.parse(text);
    } catch {
      return fail(400, "invalid_input", "invalid JSON");
    }
  }

  const built = buildListingActionRequest(id, action, raw);
  if (!built.ok) return fail(built.status, built.code, built.message);

  const token = await getSessionToken();
  if (!token) return fail(401, "not_authenticated", "not signed in");

  const result = await apiFetch<unknown>(built.path, {
    method: "POST",
    token,
    body: built.body,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: result.status });
}

import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Lets the status card check the backend without the browser ever talking to it directly. */
export async function GET() {
  const result = await apiFetch("/api/v1/health/ready");
  return NextResponse.json({ api: result.ok ? "ok" : "down" }, { headers: { "Cache-Control": "no-store" } });
}

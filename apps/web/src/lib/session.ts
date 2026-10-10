import "server-only";

import { cookies } from "next/headers";
import { apiFetch } from "./api";
import { SESSION_COOKIE } from "./cookie";
import type { MeResponse } from "./types";

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export type CurrentUser =
  | { status: "ok"; data: MeResponse }
  | { status: "unauthenticated" }
  | { status: "unavailable" };

/** Who is logged in, according to the backend (the cookie alone proves nothing). */
export async function getCurrentUser(): Promise<CurrentUser> {
  const token = await getSessionToken();
  if (!token) return { status: "unauthenticated" };
  const result = await apiFetch<MeResponse>("/api/v1/auth/me", { token });
  if (result.ok) return { status: "ok", data: result.data };
  if (result.status === 401) return { status: "unauthenticated" };
  return { status: "unavailable" };
}

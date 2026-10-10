export const SESSION_COOKIE = "eskanban_session";
/** Matches the API's absolute session cap; the server decides the real validity. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type CookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

/**
 * `Secure` is on in production. Set COOKIE_SECURE=false only to test a production build over
 * plain http on your own machine.
 */
export function sessionCookieOptions(env: {
  NODE_ENV?: string;
  COOKIE_SECURE?: string;
}): CookieOptions {
  const secure = env.COOKIE_SECURE ? env.COOKIE_SECURE !== "false" : env.NODE_ENV === "production";
  return { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: SESSION_MAX_AGE_SECONDS };
}

import type { Messages } from "@/i18n/messages/types";

/** Turns a backend error code into a message the user can act on. */
export function errorText(
  t: Messages,
  code: string | undefined,
  retryAfterSeconds?: number | null,
): string {
  switch (code) {
    case "invalid_credentials":
      return t.errors.invalidCredentials;
    case "account_locked": {
      const minutes = Math.max(1, Math.ceil((retryAfterSeconds ?? 60) / 60));
      return t.errors.accountLocked.replace("{minutes}", String(minutes));
    }
    case "weak_password":
      return t.errors.weakPassword;
    case "wrong_password":
      return t.errors.wrongPassword;
    case "forbidden":
      return t.errors.forbidden;
    case "version_conflict":
      return t.errors.versionConflict;
    case "property_not_found":
    case "listing_not_found":
      return t.errors.notFound;
    case "user_not_found":
      return t.errors.userNotFound;
    case "unavailable":
      return t.errors.unavailable;
    default:
      return t.errors.generic;
  }
}

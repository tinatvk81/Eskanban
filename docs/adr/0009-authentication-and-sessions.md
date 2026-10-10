# ADR-0009: Authentication and sessions

- Status: Proposed
- Date: 2026-10-09

## Context
Agency staff need to log in; each request must resolve to one user, one agency and one role
(ADR-0005). The owner chose mobile number + password, with SMS codes added later.

## Decision
- Login identifier: mobile number, stored normalised in E.164 (`+989121234567`). Local formats,
  Persian digits and `+98`/`0098` prefixes are all accepted. Landlines are rejected. Email is optional.
- Passwords: Argon2id with the OWASP-recommended minimum cost (19 MiB, 2 iterations, 1 lane).
  Policy: 8-128 characters, not only digits, not one repeated character.
- Sessions: opaque random tokens (`esk_...`, 256 bits). Only their SHA-256 is stored, so a database
  leak does not leak usable tokens, and a session can be revoked instantly.
  Idle expiry 7 days, sliding, capped at 30 days in total.
- Transport: `Authorization: Bearer <token>`. The web app should keep the token server-side in an
  httpOnly cookie through a Next.js route handler (backend-for-frontend), never in `localStorage`.
- Brute force: 5 consecutive failures lock the account for 15 minutes.
- Errors are indistinguishable for unknown phone, wrong password and disabled account; unknown
  phones still cost the same hashing time.
- New and reset passwords are temporary: `must_change_password` is set until the user changes it.
  Changing a password ends the user's other sessions; deactivating a user ends all of theirs.
- Roles: `require_manager` guards agency administration; all data access goes through a
  tenant-scoped session built from the authenticated user's agency (ADR-0008).
- Agencies are provisioned by the operator through `python -m app.cli` (passwords are typed at a
  hidden prompt, never passed as arguments).

## Consequences
- A valid token costs one database lookup per request; fine at this scale.
- Known limitations, accepted for now:
  - an attacker who knows a mobile number can lock that account for 15 minutes (a trade-off against guessing);
  - a locked response confirms that the number is registered;
  - there is no per-IP rate limiting yet, and the recorded client IP is the proxy's address until
    trusted-proxy handling is configured for the hosting platform;
  - no self-service reset: a manager (or the operator CLI) sets a temporary password until SMS codes exist.
- Adding SMS login/reset later needs a provider decision and per-number rate limits; the data model already fits.

## Alternatives considered
JWT access tokens (hard to revoke, easy to misuse); cookies set directly by the API (breaks across the
different default domains of web and api on the hosting platform); email login (many agents do not use email).

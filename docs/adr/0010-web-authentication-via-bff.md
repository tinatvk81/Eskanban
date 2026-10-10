# ADR-0010: Web authentication through a backend-for-frontend (BFF)

- Status: Proposed
- Date: 2026-10-09

## Context
The API issues bearer session tokens (ADR-0009). The web app and the API run as separate services,
probably on different default domains, so cookies set by the API would not be sent by browsers
reliably, and a token kept in JavaScript-readable storage can be stolen by any script injected into the page.

## Decision
- The browser talks only to the Next.js server. Route handlers under `src/app/api/` call the API.
- The session token lives in an `httpOnly`, `SameSite=Lax` cookie (`eskanban_session`), `Secure` in
  production. It is never present in a response body or in JavaScript.
- State-changing route handlers accept only same-origin requests (`Sec-Fetch-Site`, falling back to
  `Origin` vs `Host`), a CSRF defence on top of `SameSite`.
- Pages decide who is logged in by asking the API (`/auth/me`) on the server, never by trusting the cookie alone.
- The API address is a server-only variable, `API_URL`. There is no `NEXT_PUBLIC_API_URL`, so the
  browser needs no CORS access to the API.
- The cookie lives 30 days (the API's absolute cap); the API remains the authority on whether a session is valid.
- Persian and English texts live in `src/i18n/messages/`; the Persian copy should be reviewed by a native speaker.

## Consequences
- Every browser request that needs data goes through our server: one extra hop, in exchange for a much smaller attack surface.
- Pages that depend on the session are rendered per request (not static).
- The client IP seen by the API is the web server's until trusted-proxy headers are configured (ADR-0009 limitation).
- If a mobile app or public API is added later, it will use the bearer tokens directly.

## Alternatives considered
Token in `localStorage` (readable by any injected script); cookies set by the API (cross-domain problems on the
hosting platform); a JWT-in-memory plus refresh-cookie scheme (more moving parts for the same result).

# Web rules (ADR-0006, ADR-0010)

- The browser never calls the FastAPI backend. Use route handlers in `src/app/api/` (server-side `apiFetch`).
- Never put tokens in `localStorage`, `sessionStorage`, URLs, logs or response bodies.
- Every state-changing route handler must call `isSameOrigin(originHeadersFrom(request))` first and have a test.
- Pages that need a user call `getCurrentUser()` and redirect on `unauthenticated`; never trust the cookie alone.
- All visible text goes through `src/i18n/messages/*` (fa + en). Keep both files in sync (the `Messages` type enforces it).
- Colors only via tokens (`src/styles/tokens.css`); layout with logical properties (RTL-safe); touch targets >= 44px.
- Forms: labels for every input, `autocomplete` set correctly, errors in `role="alert"`, phone and password fields `dir="ltr"`.

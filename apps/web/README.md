# apps/web

Next.js (App Router, TypeScript) frontend. Persian-first (RTL) with English, light/dark themes.
The browser talks only to this server; the server talks to the API (ADR-0010).

## Run locally
```bash
# terminal 1: the API (see apps/api/README.md), running on http://localhost:8000
# terminal 2:
cd apps/web
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3000  (redirects to /fa)
```
Create a user first with `python -m app.cli create-agency ...` in `apps/api`, then sign in at `/fa/login`.

## Scripts
| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run build` / `npm start` | Production build / server (reads `PORT`) |

## Pages and routes
| Path | Purpose |
|---|---|
| `/[locale]` | Landing page and system status |
| `/[locale]/login` | Mobile number + password |
| `/[locale]/change-password` | Required after a temporary password |
| `/[locale]/dashboard` | Signed-in home (placeholder until the Files module) |
| `/api/auth/login`, `/logout`, `/change-password` | Route handlers (BFF) that call the API and manage the cookie |
| `/api/health` | Backend readiness for the status card |

## Structure
```
src/
  app/[locale]/   pages per locale (fa, en); <html lang dir> set in the layout
  app/api/        route handlers (server only)
  components/     Topbar, forms, ThemeScript/Toggle, ApiStatus
  i18n/           locale config + typed message catalogs (add strings here, never inline)
  lib/            api client, cookie options, CSRF origin check, session helpers, error texts
  styles/         tokens.css (design tokens), globals.css
```

## Conventions
See `.claude/rules/web.md`. In short: no tokens in browser storage, same-origin check on every
state-changing route handler, all text through i18n, colors only via tokens, RTL-safe CSS.

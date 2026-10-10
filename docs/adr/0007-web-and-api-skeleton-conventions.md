# ADR-0007: Web and API skeleton conventions

- Status: Accepted
- Date: 2026-10-08

## Context
Phase 1 needs a deployable walking skeleton so hosting problems surface early. Several small
choices were made while building it and should be confirmed by the owner.

## Decision
- Web: Next.js App Router, TypeScript strict, npm with a committed `package-lock.json`.
- Routing: locale-prefixed routes (`/fa`, `/en`); `<html lang dir>` set per locale; `/` redirects to `/fa`.
- Fonts: Vazirmatn self-hosted via the npm package (no external font requests; works without access to Google Fonts).
- Theming: CSS custom properties in `tokens.css`, `data-theme` on `<html>`, inline script applies the saved or OS theme before first paint.
- API: FastAPI app factory, all routes under `/api/v1`, settings from `ESKANBAN_*` environment variables, interactive docs disabled when `ESKANBAN_ENV=production`.
- Python dependencies in `requirements.txt` / `requirements-dev.txt` (pip). `pyproject.toml` holds tool config only.
- CI (GitHub Actions): PR title check, web typecheck + build, api lint + tests.
- Staging pages send `noindex`.

## Consequences
Simple, widely supported by hosting platforms. Revisit pip vs uv/Poetry when the dependency set grows,
and add a shared API client/types package when the first real endpoints exist.

## Alternatives considered
next-intl (more features, more setup — revisit when message formatting needs grow), pnpm/yarn, Poetry/uv.

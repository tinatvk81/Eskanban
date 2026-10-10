# infra

Deployment notes for Runflare (native stack, no custom Dockerfile for now — ADR-0004).

## Services (planned)
| Service | Source | Start command | Port |
|---|---|---|---|
| web | `apps/web` | `npm run build` then `npm start` | reads `PORT` |
| api | `apps/api` | `alembic upgrade head`, then `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}` | reads `PORT` |
| database | PostgreSQL (managed by Runflare) | — | — |
| cache/queue | Redis (managed by Runflare, Phase 5) | — | — |

## Environment variables
| Service | Variable | Example / meaning |
|---|---|---|
| web | `API_URL` | `https://api-staging.example.com` — read only on the web server; the browser never calls the API |
| web | `COOKIE_SECURE` | leave unset on https; `false` only to test over plain http |
| api | `ESKANBAN_ENV` | `staging` or `production` (production hides `/docs`) |
| api | `ESKANBAN_DATABASE_URL` | the PostgreSQL URL from the Runflare panel (`postgres://…` is accepted as-is) |
| api | `ESKANBAN_CORS_ORIGINS` | not needed for the web app any more (it calls the API server-to-server); keep the default |

`API_URL` is read when the web server runs, so changing it needs a restart, not a rebuild.

## First deployment checklist
1. Create the PostgreSQL service; copy its URL into `ESKANBAN_DATABASE_URL` on the api service.
2. Deploy the api, run `alembic upgrade head` once (a deploy hook or the platform's shell), check `GET /api/v1/health/ready`.
3. Create the first agency on the server: `python -m app.cli create-agency …` (see `apps/api/README.md`).
4. Deploy the web with `API_URL` pointing at the api; open `/fa/login`.
5. Staging pages already send `noindex`; still do not publish the staging address.

## To verify in the Runflare panel (not confirmed yet)
- [ ] How a service is pointed at a sub-folder of a monorepo (`apps/web`, `apps/api`), via GitHub auto-deploy or `runflare deploy`.
- [ ] Where build and start commands are configured for Python and Next.js services, and how to run the one-off migration command.
- [ ] Which Python and Node versions the platform uses (api needs Python >= 3.11, web needs Node >= 20.9).
- [ ] Whether the web service can reach the api over the platform's private network or only its public URL.
- [ ] Which proxy headers carry the real client IP (for per-IP rate limiting later).
- [ ] Free-plan limits: development/testing only; use a paid plan with backups for real agency data.
- [ ] Whether Playwright browsers can run on the platform (Phase 5; may require Docker, see ADR-0004).
Record the answers here, and in an ADR if they change a decision.

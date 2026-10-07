# ADR-0004: Technology stack and hosting

- Status: Accepted
- Date: 2026-10-07

## Context
Needs: fast web UI, API, relational data, background scraping, hosted on Runflare. Runflare natively supports Python, Next.js, PostgreSQL, Redis and also Docker.

## Decision
- Frontend: Next.js (TypeScript).
- Backend: FastAPI (Python).
- Database: PostgreSQL; cache and queue: Redis with Celery.
- Scraper: Python (Playwright/Scrapy) as a separate worker service.
- Hosting: Runflare using its native stack; no custom Dockerfile for now.

## Consequences
One backend language for API and scraping. Revisit Docker if multi-cloud or custom system dependencies (e.g. Playwright browsers) require it — this is a likely trigger in Phase 5.

## Alternatives considered
NestJS (Node), Django, .NET, Java — viable, but Python gives the best scraping ecosystem and keeps the team to one backend language.

# Project context — Eskanban (اسکان‌بان)

> Keep this file short and current. It replaces re-explaining the project in every session.

## Product
Multi-tenant SaaS for real estate agencies in Iran, designed to be internationalizable.
Replaces a slow legacy desktop EXE (2–3 min load times) with a fast web app.
Users may buy only the modules they need.

## Modules
1. **Files (فایل‌ها)** — all agency property files, filters, saved filters, expiry tracking. **MVP starts here.**
2. **Accounting (حسابداری)** — commissions, licence-related costs, agent dashboard.
3. **New listings (فایل‌های جدید)** — intake from external listing sites + lead routing.

## Confirmed features
Property–Client Matching · Transaction/Deal Pipeline · Agent Commission Dashboard ·
Lead Routing (advisor opts into province/city/regions) · Website Builder mini
(public advisor page + agency page, white-label on higher plans).

## Tenancy and roles
Tenant = agency. Roles: Manager, Advisor. Each advisor has a **private workspace**
(own files and clients); the manager sees everything and can share items. (ADR-0005)

## Plans (per seat)
Solo (1) · Small Agency (2–5) · Large Agency (6+, per-seat pricing). Advisor count varies per agency.

## Stack
Next.js (TypeScript) · FastAPI (Python) · PostgreSQL · Redis + Celery · Playwright/Scrapy.
Hosting: Runflare, native stack, no custom Dockerfile for now. (ADR-0004)

## UX principles
Persian-first RTL, English-ready i18n. Light + dark themes. Many users are middle-aged or older:
plain labels, large click targets, familiar wording, no jargon. Colors: see design-system.md.

## Working rules
English for code/docs/commits. Conventional Commits via hook. Commit/push only after owner accepts.
Ask when unsure. (CLAUDE.md, ADR-0002)

## Decision index
| ADR | Topic | Status |
|---|---|---|
| 0001 | Record architecture decisions | Accepted |
| 0002 | Git workflow and versioning | Proposed |
| 0003 | Single monorepo layout | Accepted |
| 0004 | Technology stack and hosting | Accepted |
| 0005 | Multi-tenancy and access model | Accepted |
| 0006 | Internationalization and theming | Accepted |

## Open questions
- Branch/merge method (PRs vs local merges) — ADR-0002.
- Whether to import data from the legacy EXE — decide before Phase 2 ends.
- Legal review of scraping each external listing source — before Phase 5.

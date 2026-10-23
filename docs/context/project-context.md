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

## Tenancy, roles and login
Tenant = agency. Roles: Manager, Advisor. Each advisor has a **private workspace**
(own files and clients); the manager sees everything and can share items. (ADR-0005, ADR-0008)
Login: **mobile number + password** (SMS codes later). Server-side revocable sessions; the web app keeps
the token in an httpOnly cookie through its own server (BFF). Agencies are created by the operator CLI. (ADR-0009, ADR-0010)

## Plans (per seat)
Solo (1) · Small Agency (2–5) · Large Agency (6+, per-seat pricing). Advisor count varies per agency.

## Stack
Next.js 16 (TypeScript) · FastAPI (Python) · PostgreSQL + SQLAlchemy 2 + Alembic · Redis + Celery (Phase 5) · Playwright/Scrapy (Phase 5).
Hosting: Runflare, native stack, no custom Dockerfile for now. (ADR-0004)

## UX principles
Persian-first RTL, English-ready i18n. Light + dark themes. Many users are middle-aged or older:
plain labels, large click targets, familiar wording, no jargon. Colors: see design-system.md.

## Working rules
English for code/docs/commits. Conventional Commits via hook. Work on a branch, open a PR, squash merge.
Commit/push only after the owner accepts (`scripts/ship.sh`). Ask when unsure. (CLAUDE.md, ADR-0002)

## Status
Phase 0 done except staging. Phase 1: tenants, roles, auth, web shell and login are built; GitHub CI has not run yet.
Next: Files module (waiting for the field list from the legacy app). Details: docs/roadmap.md.

## Decision index
| ADR | Topic | Status |
|---|---|---|
| 0001 | Record architecture decisions | Accepted |
| 0002 | Git workflow and versioning | Accepted |
| 0003 | Single monorepo layout | Accepted |
| 0004 | Technology stack and hosting | Accepted |
| 0005 | Multi-tenancy and access model | Accepted |
| 0006 | Internationalization and theming | Accepted |
| 0007 | Web and API skeleton conventions | Accepted |
| 0008 | Database and tenant isolation | Proposed |
| 0009 | Authentication and sessions | Proposed |
| 0010 | Web authentication through a BFF | Proposed |
| 0011 | Property files data model | Proposed |

## Open questions
- Runflare specifics (sub-folder deploys, start/migration commands, versions, proxy headers) — see infra/README.md.
- Fields of a property file, taken from the legacy app — before Phase 2.
- Whether to import data from the legacy EXE — decide before Phase 2 ends.
- SMS provider for codes/reset — before SMS login.
- Legal review of scraping each external listing source — before Phase 5.

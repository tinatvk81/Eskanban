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
(own files and clients); the manager sees everything and can share items. `owner_user_id` identifies the Advisor responsible for the agency file, not the real-world property owner. Owner contact details (`owner_name`, `owner_phone`) are visible only to the Manager and that assigned Advisor; other advisors viewing a shared file must not receive them. A Manager may create a file for an active Advisor or reassign it; an Advisor may create files only for themselves.
Login: **mobile number + password** (SMS codes later). Server-side revocable sessions; the web app keeps
the token in an httpOnly cookie through its own server (BFF). Agencies are created by the operator CLI.

## Plans (per seat)
Solo (1) · Small Agency (2–5) · Large Agency (6+, per-seat pricing). Advisor count varies per agency.

## Stack
Next.js 16 (TypeScript) · FastAPI (Python) · PostgreSQL + SQLAlchemy 2 + Alembic · Redis + Celery (Phase 5) · Playwright/Scrapy (Phase 5).
Hosting: Runflare, native stack, no custom Dockerfile for now.

## UX principles
Persian-first RTL, English-ready i18n. Light + dark themes. Many users are middle-aged or older:
plain labels, large click targets, familiar wording, no jargon. Colors: see design-system.md.

## Working rules
English for code/docs/commits. Conventional Commits via hook. Work on a branch, open a PR, squash merge.
Commit/push only after the owner accepts (`scripts/ship.sh`). Ask when unsure.

## Status
Phase 0 foundation is complete except for staging verification. Phase 1 platform features are implemented locally; GitHub CI's first run, staging deployment, and branch protection remain open.
Phase 2 Files MVP is in progress: Backend APIs and tests exist; Frontend list, filters, detail, history and property actions are implemented. Create/edit forms, Dashboard statistics integration, user-management UI, attachments, and integration/authorization verification remain. Similar-property search is deferred for security review and must not be exposed or extended without a separate decision. See docs/roadmap.md.

## Open questions
- Runflare specifics (sub-folder deploys, start/migration commands, versions, proxy headers) — see infra/README.md.
- Whether to import data from the legacy EXE — decide before Phase 2 exits.
- SMS provider for codes/reset — before SMS login.
- Legal review of scraping each external listing source — before Phase 5.

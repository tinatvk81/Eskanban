# Roadmap

Phases are ordered by dependency, not dates. A phase is done only when its exit criteria are met.

## Phase 0 — Foundation
- Repo, docs, ADRs, hooks, changelog (this commit set).
- Runflare project created; PostgreSQL and Redis provisioned (staging).
- Package/tooling choices for web and api recorded.
- **Exit:** clean clone → `make hooks` works; a bad commit message is rejected; staging environment reachable.

## Phase 1 — Platform skeleton
- Auth, agencies (tenants), roles (Manager/Advisor), private workspaces.
- App shell: RTL layout, i18n layer, light/dark themes from design tokens.
- CI: lint + tests per app; auto-deploy staging from `main`.
- **Exit:** two agencies cannot see each other's data (automated test); advisor cannot see another advisor's items.

## Phase 2 — MVP: Files module
- Property file CRUD (sale, rent, mortgage, pre-purchase), photos/attachments.
- Fast filtering, saved filters, search; status lifecycle; contract-expiry tracking; activity log.
- Open question: import from legacy EXE data.
- **Exit:** the owner's father's agency can run daily file work on it; list pages load in seconds on old hardware.

## Phase 3 — Clients and matching
- Client requests, Property–Client Matching with ranked results.
- **Exit:** a client request returns relevant files from the advisor's workspace.

## Phase 4 — Deals and accounting
- Deal pipeline stages; commission dashboard; licence-related cost tracking.
- **Exit:** a deal moves through stages and its commission is computed and reported.

## Phase 5 — New listings and lead routing
- Scraper workers and queue; deduplication; advisors opt into province/city/regions and see only those.
- **Exit:** new listings from approved sources reach matching advisors automatically.

## Phase 6 — Websites, plans, white-label
- Public advisor and agency pages; per-seat plans and billing; white-label on top plan.

## Phase 7 — AI / agents (future)
- Deduplication, matching assistants, data-quality helpers in `apps/agents`.

## Risks
| Risk | Mitigation |
|---|---|
| Scraping external sites may breach their terms or local rules | Legal/ToS review per source before Phase 5; prefer official feeds or partnerships |
| Playwright needs browser binaries not native on the host | Re-evaluate Docker (ADR-0004) at Phase 5 |
| Tenant data leakage | Isolation tests from Phase 1; row-level security |
| Low adoption by less tech-savvy agents | Familiar wording, large targets, test with real agents each phase |

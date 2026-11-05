# Roadmap

Phases are ordered by dependency, not dates. A phase is done only when its exit criteria are met.

## Progress
| Phase | State |
|---|---|
| 0 Foundation | Done, except the Runflare staging environment (needs the owner's account) |
| 1 Platform skeleton | Built and tested locally: tenants, roles, auth, app shell, i18n, themes, CI definition. Open: first CI run on GitHub, staging deploy, branch-protection ruleset |
| 2 Files (MVP) | Backend built (model, API, tests); web screens next |
| 3–8 | Not started

## Phase 0 — Foundation
- Repo, docs, ADRs, hooks, changelog (this commit set).
- Runflare project created; PostgreSQL and Redis provisioned (staging).
- Package/tooling choices for web and api recorded.
- **Exit:** clean clone → `make hooks` works; a bad commit message is rejected; staging environment reachable.

## Phase 1 — Platform skeleton
- Auth, agencies (tenants), roles (Manager/Advisor), private workspaces.
- App shell: RTL layout, i18n layer, light/dark themes from design tokens.
- CI: lint + tests per app; auto-deploy staging from `master`.
- **Exit:** two agencies cannot see each other's data (automated test); advisor cannot see another advisor's items.

## Phase 2 — MVP: Files module
- Property file CRUD (sale, rent, mortgage, pre-purchase), photos/attachments.
- Fast filtering, saved filters, search; status lifecycle; contract-expiry tracking; activity log.
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
- Web-search assistant (replaces the legacy chat/bot): answers advisor questions by searching the internet. Lives in apps/agents.
- Deduplication, matching assistants, data-quality helpers in `apps/agents`.

  ## Phase 8 — Map view (last)
  - Interactive map of files and areas. The plain `location_url` map-link field stays in Phase 2.
  - **Exit:** an advisor can see filtered files on a map.

## Risks
| Risk | Mitigation |
|---|---|
| Scraping external sites may breach their terms or local rules | Legal/ToS review per source before Phase 5; prefer official feeds or partnerships |
| Playwright needs browser binaries not native on the host | Re-evaluate Docker (ADR-0004) at Phase 5 |
| Tenant data leakage | Isolation tests from Phase 1; row-level security |
| Low adoption by less tech-savvy agents | Familiar wording, large targets, test with real agents each phase |

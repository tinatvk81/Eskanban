# Roadmap

Phases are ordered by dependency, not dates. A phase is done only when its exit criteria are met.

## Progress
| Phase | State |
|---|---|
| 0 Foundation | Done, except the Runflare staging environment (needs the owner's account) |
| 1 Platform skeleton | Built and tested locally: tenants, roles, auth, app shell, i18n, themes, CI definition. Open: first CI run on GitHub, staging deploy, branch-protection ruleset |
| 2 Files (MVP) | Backend APIs and tests exist. Frontend list, filters, detail, history and property actions are implemented. Create/edit forms, Dashboard statistics integration, user-management UI, attachments, and integration/authorization verification remain. Owner-contact privacy remediation is implemented; full backend suite: 304 passed, 1 xfailed, 0 failed. |
| 3–7 | Not started |

## Phase 0 — Foundation
- Repo, docs, hooks, changelog (this commit set).
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
| Playwright needs browser binaries not native on the host | Re-evaluate whether the deployment platform needs Docker at Phase 5 |
| Tenant data leakage | Isolation tests from Phase 1; row-level security |
| Low adoption by less tech-savvy agents | Familiar wording, large targets, test with real agents each phase |

## Phase 2 — Verification findings

### Security and access-control review

| Finding | State | Notes |
|---|---|---|
| Property serialization exposes owner contact fields to shared advisors | Remediated; tests passed | A dedicated `can_view_owner_contact` policy now allows Managers and the file-owning Advisor to see `owner_name` and `owner_phone`. Shared Advisors receive `null` for both fields in list and detail responses. |
| Property history exposes owner contact changes to shared advisors | Remediated; tests passed | History responses omit `owner_name` and `owner_phone` from `changes` for shared Advisors. Filtering is applied to a response copy; persisted JSONB remains unchanged. |
| Similar-property search may reveal indirect information about inaccessible files | Discovered / Deferred | Potential information side-channel. Requires a separate product/security decision; no implementation change approved. |

### Test execution status

| Item | State | Notes |
|---|---|---|
| Focused property API tests | Passed | `tests/test_properties_api.py`: 23 passed, 0 failed in 4.21s, using the isolated database `eskanban_test_run_20261119`. Covers Manager, file-owning Advisor, and shared Advisor contact visibility, history masking, and persisted JSONB immutability. |
| Tenant aggregate query review | Reviewed; no unsafe production shape found | `apps/api/app/services/properties.py`: statistics aggregates explicitly use `.select_from(Property)` and an agency condition. `apps/api/app/services/agencies.py`: user counts explicitly use `.select_from(User)`. The known unsafe shape remains covered by the strict xfail test. |
| Full backend test suite | Passed with one expected failure | `pytest -q`: 304 passed, 1 xfailed, 0 failed in 17.89s using the isolated database `eskanban_test_run_20261119`. The xfail documents the unsafe `COUNT FILTER` shape without an explicit `FROM`; it remains intentionally excluded from safe query shapes. |
| Test database configuration | Confirmed | `tests/conftest.py` reads `ESKANBAN_TEST_DATABASE_URL` from the process environment. The successful run explicitly targeted the isolated test database; do not use a development or valuable database. |
| PostgreSQL readiness | Confirmed | Local PostgreSQL 18 is available on port 5432. CI currently uses PostgreSQL 16; local/CI version parity remains to be checked. |
| Starlette TestClient / httpx deprecation warning | Non-blocking | The successful run reports a deprecation warning recommending `httpx2`. Track separately; it did not cause test failures. |

### Verification follow-up

- Continue using a dedicated isolated database for local test runs. The test fixture downgrades the target database to `base` at session teardown.
- Tenant query-shape review completed: the known unsafe `COUNT FILTER` shape remains documented as a strict xfail. Production searches found no matching unsafe aggregate query. Property statistics use `.select_from(Property)` and an explicit `Property.agency_id == actor.agency_id` condition; agency user counts use `.select_from(User)`. No production code change was needed.
- Similar Search remains separately deferred pending a product/security decision.
- Frontend detail, history and property-action components/routes exist and are wired into the detail page. Their integration, failure handling and role-based behavior still require verification, especially owner-contact visibility and Manager-only actions. Backend authorization and response masking remain the security enforcement boundary.
- Update this section as further findings are verified, remediated, and tested.


## Phase 2 — Backend/Frontend parity and implementation plan (2026-11-19)

This inventory reflects the inspected Backend routes, Frontend routes/components, and the detail-page integration. "Implemented" means the relevant code exists; it does not imply that integration, end-to-end, or role-based verification is complete.

| Capability | Backend | Frontend | Current state |
|---|---|---|---|
| List, filters and pagination | `GET /properties` | `[locale]/files/page.tsx`, filter/table/pagination components | Implemented |
| Detail | `GET /properties/{id}` | `[locale]/files/[id]/page.tsx`, `PropertyDetail.tsx` | Implemented; integration and UX verification pending |
| History | `GET /properties/{id}/history` | `PropertyHistory.tsx`, loaded by the detail page | Implemented; integration, failure-state and privacy verification pending |
| Property actions | Status, favorite, share, reassign and soft-delete endpoints | `PropertyActions.tsx` and BFF route `api/properties/[id]/[action]` | Implemented; integration and authorization verification pending |
| Create file | `POST /properties` | No create form/route identified in the inspected Frontend inventory | Frontend gap |
| Edit file | `PUT /properties/{id}` with version check | No edit form/route identified in the inspected Frontend inventory | Frontend gap |
| Statistics | `GET /properties/stats` | Not currently consumed by the Dashboard | Frontend integration gap |
| Similar-property search | `GET /properties/similar` exists | No Frontend integration identified | Deferred for security review; do not implement or expose |
| User management | `users.py`: list, create, deactivate and reset password | No user-management page identified | Frontend gap |
| Geography | `reference.py` | `api/geo/` route handlers and city autocomplete | Implemented; retain integration coverage |
| Photos and attachments | No model, route, migration or storage implementation identified | None identified | Not implemented |

### Coordinated implementation order

Each feature must be completed as a Backend + Frontend + tests + documentation slice. Do not complete all Backend work first and postpone the Frontend.

1. **F1 — Verify Detail, History and Actions.** The routes and components already exist. Verify API response compatibility, loading/error states, refresh behavior, BFF behavior, role-based access and owner-contact privacy. Add missing integration and authorization tests. Do not rewrite existing functionality without evidence of a defect.
2. **F2 — Create property form.** Build the Frontend form against the existing create API, including validation, geography/reference data, Manager assignment rules and successful navigation/feedback. Add Backend/Frontend tests as needed.
3. **F3 — Edit property form.** Connect the existing update API, include the required `version`, and handle stale-version conflicts without silently overwriting another user's changes.
4. **F4 — Dashboard statistics.** Connect the existing statistics endpoint to the Dashboard and verify tenant scoping, role behavior, loading and error states.
5. **F5 — User management.** Build the Manager-facing UI for the existing user-management APIs and verify seat limits, active-user selection, deactivation and password-reset behavior.
6. **F6 — Photos and attachments.** First define authorization, storage, upload/download constraints and lifecycle; then implement Backend and Frontend together. Do not assume a storage design before review.

### Security and scope constraints

- Owner contact fields (`owner_name`, `owner_phone`) are visible only to a Manager or the Advisor assigned to the property file. A shared Advisor who is not the file owner must not receive these fields. `owner_user_id` identifies the Advisor responsible for the agency file; it is not the real-world property owner.
- A Manager may create a file for an active Advisor or reassign a file. An Advisor may create files only for themselves.
- Backend authorization and response filtering are the security boundary; hiding a Frontend control is not sufficient.
- Similar Search remains deferred because it may create an information side-channel. Its existing Backend route and tests do not authorize Frontend exposure or further development. Revisit only after a separate security/product decision.
- `apps/web/web.rar` is untracked and must remain excluded from commits.
- The web package has no `lint` script. Current CI checks are typecheck, tests and production build; do not describe lint as an active web CI check.

### Verification notes

- Frontend unit tests previously passed: 11 test files, 58 tests; `npm run typecheck` passed.
- Frontend verification after F1 action-route tests: `npm test` passed with 12 test files and 68 tests; `npm run typecheck` passed.
- `git diff --check` passed after the test addition.
- Vite emitted a non-blocking warning about ESM syntax in `vitest.config.ts` under `configLoader: 'native'`. No configuration change was made because all tests passed.
- Backend suite previously passed: 304 passed, 1 xfailed, 0 failed, using the isolated database `eskanban_test_run_20261119`.
- These results are not evidence of complete end-to-end or browser integration coverage.
- The property action BFF route now has direct route tests in `apps/web/src/app/api/properties/[id]/[action]/route.test.ts`: 10 passed. Coverage includes CSRF rejection, missing origin, malformed JSON, invalid IDs/actions/bodies, missing session, validated forwarding, backend errors and 204 responses.
- Before running the production build, check whether a development server is active to avoid `.next` directory conflicts.
- Keep local tests pointed at a dedicated isolated test database. Never point the test fixture at a development or valuable database; the fixture downgrades its target database during teardown.
- Local PostgreSQL 18 and CI PostgreSQL 16 parity remains to be checked.
- The existing Starlette TestClient/httpx deprecation warning is non-blocking and should be handled separately after compatibility review.

Update this section after each feature slice with the actual files changed, tests run, results, unresolved risks and the next handoff.

## Documentation maintenance

- The former numbered decision-record workflow is retired and will not be continued or replaced.
- Preserve practical rules and constraints in `.claude/rules/` and `docs/context/project-context.md`.
- Keep implementation progress, verification results, risks, and pending decisions in this Roadmap. Update the existing project context when enduring product or technical rules change.

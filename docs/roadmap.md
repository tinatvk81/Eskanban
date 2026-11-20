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

---

## Execution Checklist — Operational Workflow

This section is the central execution checklist. Use it to decide what to work on next.
The existing phase descriptions, verification findings, security constraints and historical
test results above remain part of the project record.

### Status definitions

| Status | Meaning |
|---|---|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Implemented and acceptance criteria verified with evidence |
| `[!]` | Blocked or a defect needs investigation |
| `[-]` | Intentionally deferred |

Do not mark a task `[x]` merely because code exists. Verify its acceptance criteria and
record the actual test evidence first.

### Working agreement

1. Start each session by checking the current branch and `git status`.
2. Read this checklist and the latest Session Handoff.
3. Inspect only the relevant implementation, API contract and tests for the current task.
4. Implement one coordinated Backend + Frontend + tests + documentation slice.
5. Run focused tests first; run integration and regression tests at the appropriate milestones.
6. Record findings, decisions, changed files, test commands/results and remaining risks here.
7. Preserve unrelated user changes. Never reset, clean, overwrite or commit unrelated files.
8. Do not commit, push, merge or change branches without explicit approval.

### Test strategy

- **Feature tests:** Run the smallest relevant test group while implementing a feature.
- **Integration tests:** Verify the interaction between Backend endpoints, Frontend BFF/routes
  and UI behavior at integration boundaries.
- **Full regression:** Run the complete Backend and Frontend test suites at the end of a
  meaningful phase or before a release/merge.
- Test commands, environment requirements and the test-file index belong in `docs/testing.md`.
- Do not rely on historical test counts as proof that the current checkout passes.
- Never run tests against a development or valuable database. The Backend test fixture can
  downgrade its configured target database during teardown.

### Phase 2 — Files MVP execution checklist

#### F1 — Detail, History and Actions verification

Goal: verify the existing implementation end-to-end before adding new Files functionality.

**Backend**
- [x] Detail serialization and owner-contact authorization reviewed.
- [x] History response filtering reviewed; persisted JSONB remains unchanged.
- [x] Property action authorization reviewed.
- [x] Focused property API tests passed (historical evidence: 23 passed).
- [x] Full Backend suite passed (historical evidence: 304 passed, 1 xfailed).
- API areas:
  - `GET /properties/{id}`
  - `GET /properties/{id}/history`
  - Existing status, favorite, share, reassign and delete actions.

**Frontend**
- [x] Detail page and component exist.
- [x] History component exists.
- [x] Property actions component exists.
- [x] Property action BFF route has direct route tests (historical evidence: 10 passed).
- [~] Direct component tests for `PropertyDetail`, `PropertyHistory` and `PropertyActions`.
- [ ] Verify role-dependent UI behavior for Manager and Advisor.
- [ ] Verify detail-page loading, error, unavailable-history and empty-history states.
- [ ] Verify action success, failure, busy state and refresh/redirect behavior.
- [ ] Verify owner-contact display against Backend responses for Manager, assigned Advisor
  and shared non-assigned Advisor.
- [ ] Verify page-level integration of detail, history, vocab and Manager-only user data.

**Relevant implementation**
- Backend:
  - `apps/api/app/api/routes/properties.py`
  - `apps/api/app/services/properties.py`
  - `apps/api/app/schemas/property.py` (verify the current schema path before editing)
- Frontend:
  - `apps/web/src/app/[locale]/files/[id]/page.tsx`
  - `apps/web/src/components/.../PropertyDetail.tsx` (verify exact current path)
  - `apps/web/src/components/.../PropertyHistory.tsx` (verify exact current path)
  - `apps/web/src/components/.../PropertyActions.tsx` (verify exact current path)
  - `apps/web/src/app/api/properties/[id]/[action]/route.ts`
- Tests:
  - `apps/api/tests/test_properties_api.py`
  - `apps/api/tests/test_property_service.py`
  - `apps/web/src/app/api/properties/[id]/[action]/route.test.ts`
  - `apps/web/src/lib/propertyActions.test.ts`
  - `apps/web/src/lib/propertyDetail.test.ts`
  - Add component/page tests in the matching Frontend directories.

**Acceptance criteria**
- Backend remains the enforcement boundary for authorization and owner-contact privacy.
- Shared Advisors who are not assigned never receive owner contact values.
- Manager-only actions are unavailable to Advisors in the UI and rejected by Backend.
- Detail and history states are understandable and do not silently hide failures.
- Successful actions update or navigate to the correct state.
- Relevant component/page integration tests pass.

**Current state:** `[~]` Existing implementation and Backend/BFF coverage are present; direct UI and
page integration verification remain.

#### F2 — Create property form

- [ ] Inspect and document the current create API schema and validation rules.
- [ ] Confirm Manager/Advisor ownership rules and geography/reference-data contract.
- [ ] Implement the Frontend create form and its BFF/API interaction.
- [ ] Handle field validation, API errors, loading and successful navigation/feedback.
- [ ] Add Backend tests only for uncovered behavior or discovered defects.
- [ ] Add Frontend form and route tests.
- [ ] Update this checklist with exact changed paths and test evidence.

API: `POST /properties`

Acceptance criteria:
- Advisor-created files belong to that Advisor.
- Manager can create a file for an active Advisor.
- Invalid data is reported clearly.
- Successful creation navigates to or displays the new file.
- Backend authorization and validation are tested.

#### F3 — Edit property form

- [ ] Inspect the current update API, schema and version-conflict behavior.
- [ ] Implement the Frontend edit form and BFF/API interaction.
- [ ] Include the required `version` value.
- [ ] Handle stale-version conflicts without silently overwriting another user's changes.
- [ ] Add tests for successful update, validation, authorization and version conflict.
- [ ] Record changed paths and test evidence.

API: `PUT /properties/{id}`

Acceptance criteria:
- Only authorized users can edit the file.
- The current version is sent with the update.
- A stale version produces a clear conflict state.
- No silent last-write-wins overwrite is introduced.

#### F4 — Dashboard statistics

- [ ] Inspect the existing statistics response and Dashboard structure.
- [ ] Connect the existing statistics API to the Dashboard.
- [ ] Verify tenant scoping and role behavior.
- [ ] Implement loading, empty and error states.
- [ ] Add Frontend and integration tests.

API: `GET /properties/stats`

Acceptance criteria:
- Statistics belong only to the current agency.
- Dashboard values match the API response.
- Loading and failure states are handled.
- No cross-tenant information is exposed.

#### F5 — User management

- [ ] Inspect existing user APIs, schemas, seat limits and authorization.
- [ ] Implement the Manager-facing user-management UI.
- [ ] Cover listing, creation, deactivation and password reset.
- [ ] Verify active-user selection and agency seat constraints.
- [ ] Add Frontend and integration tests.

Backend reference: `apps/api/app/api/routes/users.py` (verify exact current path).

Acceptance criteria:
- Only authorized Managers can manage agency users.
- Seat limits and active-user constraints are enforced by Backend.
- Deactivation and password reset have clear success/failure feedback.
- Advisors cannot access Manager-only user-management operations.

#### F6 — Photos and attachments

- [-] Implementation deferred until storage and security design is approved.

Before implementation:
- [ ] Define storage provider and object lifecycle.
- [ ] Define upload/download authorization.
- [ ] Define file-size, content-type and file-count constraints.
- [ ] Define deletion, replacement and retention behavior.
- [ ] Define migration and backup implications.
- [ ] Approve the design before implementation.

Acceptance criteria:
- Backend authorization protects every upload/download/delete operation.
- Storage access does not expose private files.
- Frontend upload, progress, error and deletion states are tested.
- Storage lifecycle and operational requirements are documented.

### Deferred / restricted scope

- [-] Similar-property search: deferred because of potential information side-channel risk.
  Do not expose or extend it without a separate product/security decision.
- [-] English copy polishing and translation refinement: low priority; revisit after core
  product functionality.
- [ ] Legacy EXE data import: product decision required before Phase 2 exit.
- [ ] Runflare staging verification: requires the owner's account and environment access.
- [ ] GitHub CI first run, staging deployment and branch-protection ruleset: Phase 1 follow-up.
- [ ] PostgreSQL 18 local / PostgreSQL 16 CI parity: verify before relying on version-specific
  behavior.

### Phase exit checklist

A phase is not complete until:
- [ ] All in-scope tasks have evidence-backed status.
- [ ] Backend and Frontend behavior are aligned.
- [ ] Relevant feature and integration tests pass.
- [ ] Full regression suites pass, or remaining failures are explicitly documented and accepted.
- [ ] Security and tenant-isolation requirements are verified.
- [ ] Documentation and operational instructions are updated.
- [ ] Remaining risks and deferred work are recorded.

### Session Handoff

Update this section at the end of each work session.

**Current focus:** F1 — Detail, History and Actions verification.

**Last verified repository state (2026-11-19):**
- Branch: `master`
- Local `master` matched `origin/master`.
- Untracked file: `apps/web/web.rar` — preserve; do not add or commit.
- Backend historical regression: 304 passed, 1 xfailed, 0 failed.
- Frontend historical regression: 12 files, 68 tests passed; typecheck passed.
- BFF property-action route historical tests: 10 passed.
- These are historical results, not a claim that tests were rerun after this documentation update.

**Next actions:**
1. Finish F1 direct component and page integration tests.
2. Run focused Frontend tests and typecheck.
3. Run relevant Backend tests if implementation changes affect API behavior.
4. Update F1 status only after acceptance criteria have evidence.
5. Continue to F2 only after F1 is verified.

**Last updated:** 2026-11-19

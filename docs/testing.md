# Testing Guide

This document is the operational reference for running and organizing Eskanban tests.
The current execution status and feature acceptance criteria live in `roadmap.md`.

## 1. Testing principles

- Prefer focused tests during feature development.
- Run integration tests at Backend/Frontend boundaries.
- Run full regression suites at phase completion and before release/merge.
- Add tests for the behavior being changed; do not create duplicate tests without a reason.
- A passing unit test does not prove browser-level or end-to-end integration.
- Never use a development or valuable database as the Backend test database.
- Preserve existing user changes and test data.

## 2. Test layers

| Layer | Purpose | When to run |
|---|---|---|
| Feature/unit | Validate a specific function, component, route or service | During implementation |
| API | Validate request/response, validation and authorization | When API behavior changes |
| Integration | Validate interaction across API, BFF and UI boundaries | At feature integration |
| Full regression | Detect cross-feature regressions | Phase completion and pre-release |

## 3. Backend tests

Location: `apps/api/tests/`

Test configuration:
- `apps/api/pyproject.toml`
- Pytest test path: `tests`
- Test database environment variable: `ESKANBAN_TEST_DATABASE_URL`

Run from the API directory.

### Prerequisites

- Python environment and project dependencies installed.
- PostgreSQL available.
- `ESKANBAN_TEST_DATABASE_URL` explicitly points to a dedicated disposable test database.
- The test database contains no valuable data.

The test fixture may downgrade the configured database during session teardown.
Always inspect the target database URL before running tests.

### Commands

```bash
cd apps/api

# Full Backend suite. Always set the isolated DB inline, for example:
# ESKANBAN_TEST_DATABASE_URL='postgresql+psycopg://<user>:<password>@127.0.0.1:5432/<isolated_test_db>' .venv/bin/python -m pytest -q
pytest -q

# Focused property API tests
pytest tests/test_properties_api.py -q

# Property service tests
pytest tests/test_property_service.py -q

# Security and tenant isolation
pytest tests/test_security.py tests/test_tenancy.py tests/test_tenancy_statement_shapes.py -q

# Authentication
pytest tests/test_auth_api.py tests/test_auth_service.py -q

# Users and agencies
pytest tests/test_users_api.py tests/test_agencies.py -q
```

## 4. Frontend Tests

Location: `apps/web/`

Test runner: Vitest.

Run from the web directory.

### Commands

```bash
cd apps/web

# Full Frontend suite (from the repo root use: npm --prefix apps/web test)
npm test

# TypeScript typecheck
npm run typecheck

# Focused property action tests
npm test -- src/lib/propertyActions.test.ts

# Focused property detail helper tests
npm test -- src/lib/propertyDetail.test.ts

# Property action BFF tests
npm test -- 'src/app/api/properties/[id]/[action]/route.test.ts'

# Production build
npm run build
```

## 5. Test index

This is a domain-level index, not a list of every individual test case.
Update it when test files are added, removed or moved.

### Backend

| Domain | Test files |
|---|---|
| Agencies | `tests/test_agencies.py` |
| Authentication API | `tests/test_auth_api.py` |
| Authentication services | `tests/test_auth_service.py` |
| CLI | `tests/test_cli.py` |
| Health and readiness | `tests/test_health.py`, `tests/test_ready.py` |
| Migrations | `tests/test_migration_0004.py` |
| Phone and URL validation | `tests/test_phone.py`, `tests/test_url.py` |
| Property API | `tests/test_properties_api.py` |
| Property schemas | `tests/test_property_schema.py` |
| Property services | `tests/test_property_service.py` |
| Security | `tests/test_security.py` |
| Tenancy | `tests/test_tenancy.py`, `tests/test_tenancy_statement_shapes.py` |
| Users | `tests/test_users_api.py` |
| Shared fixtures | `tests/conftest.py` |

### Frontend

| Domain | Test files |
|---|---|
| Login BFF | `src/app/api/auth/login/route.test.ts` |
| Logout BFF | `src/app/api/auth/logout/route.test.ts` |
| Property create BFF | `src/app/api/properties/route.test.ts` |
| Property action BFF | `src/app/api/properties/[id]/[action]/route.test.ts` |
| Property detail page | `src/app/[locale]/files/[id]/page.test.tsx` |
| Property create page | `src/app/[locale]/files/new/page.test.tsx` |
| Property detail/history/actions components | `src/components/f1.components.test.tsx` |
| Property create form component | `src/components/PropertyForm.test.tsx` |
| Property create form with the real `CityAutocomplete` | `src/components/PropertyForm.integration.test.tsx` |
| City selection (real `CityAutocomplete`, no mock) | `src/components/CityAutocomplete.select.test.tsx` |
| API client | `src/lib/api.test.ts` |
| Cookie handling | `src/lib/cookie.test.ts` |
| Error messages | `src/lib/errorText.test.ts`, `src/lib/errorText.actions.test.ts` |
| Formatting | `src/lib/format.test.ts` |
| Origin / CSRF helpers | `src/lib/origin.test.ts` |
| Property action validation | `src/lib/propertyActions.test.ts` |
| Property create validation | `src/lib/propertyCreate.test.ts` |
| Property detail helpers | `src/lib/propertyDetail.test.ts` |
| Property form payload builder | `src/lib/propertyForm.test.ts` |
| Property query helpers | `src/lib/propertyQuery.test.ts` |

The Frontend test inventory includes direct component tests and a page-level test for
`FileDetailPage`. These tests cover selected component behavior and server-page orchestration;
they do not establish full browser E2E coverage or independently prove Backend authorization.

## 6. Feature test selection

Choose tests based on the behavior being changed.

| Change | Start with |
|---|---|
| Property detail serialization or privacy | `test_properties_api.py`, `test_property_service.py` |
| Property history | `test_properties_api.py`, `test_property_service.py` |
| Property action authorization | `test_properties_api.py`, `test_property_service.py` |
| Property action BFF | `route.test.ts`, `propertyActions.test.ts` |
| Property detail UI | New component/page tests; `propertyDetail.test.ts` for helper regressions |
| Create/edit property | Property API/service tests and new form/BFF tests |
| Statistics | Property API/service tests and Dashboard integration tests |
| User management | `test_users_api.py` and new Frontend tests |
| Tenant isolation | `test_tenancy.py`, `test_security.py`, `test_tenancy_statement_shapes.py` |
| Authentication/session | Auth API/service tests and login/logout BFF tests |

## 7. Security-sensitive test requirements

For every property-related feature, consider:
- Manager access.
- Assigned Advisor access.
- Shared but non-assigned Advisor access.
- Cross-agency access.
- Missing/expired session.
- Invalid or malformed identifiers and request bodies.
- Whether sensitive fields are absent or masked in responses.
- Whether history filtering mutates only the response copy, not persisted JSONB.

Owner-contact policy:
- `owner_name` and `owner_phone` are visible only to Manager and the Advisor assigned to
  the property file.
- `owner_user_id` identifies the responsible Advisor, not the real-world property owner.
- Backend authorization and response filtering are mandatory. Frontend hiding is not a
  security control.

## 8. Integration and regression

At a feature integration point:
1. Run focused Backend tests for changed API behavior.
2. Run focused Frontend route/helper/component tests.
3. Run Frontend typecheck.
4. Verify API/BFF request and response compatibility.
5. Verify role behavior and failure states.

At phase completion:
1. Run the complete Backend suite against the isolated test database.
2. Run the complete Frontend test suite.
3. Run Frontend typecheck.
4. Run production build when relevant and when no conflicting development server is active.
5. Record exact commands, pass/fail counts, warnings and environment details in `roadmap.md`.

## 9. Known limitations and warnings

- Latest Backend result (2026-11-21, isolated DB): 305 passed, 1 xfailed, 0 failed. Exact counts are kept in `roadmap.md`; re-run before relying on them.
- One strict xfail is expected: `test_unsafe_shapes_are_documented[count filter without select_from]` in `tests/test_tenancy_statement_shapes.py`. It documents an unscoped query shape that must never be written; if it starts passing, move the shape to `SAFE_SHAPES`.
- Latest Frontend result (2026-11-21): 21 test files, 220 tests passed; typecheck passed. Re-run before
  relying on it.
- The Backend suite previously emitted a Starlette TestClient/httpx deprecation warning.
  It was non-blocking; review compatibility before changing dependencies.
- Vitest previously emitted a non-blocking ESM/configuration warning for
  `vitest.config.ts` with `configLoader: 'native'`.
- Local PostgreSQL 18 / CI PostgreSQL 16 parity remains to be checked.
- The web package currently has no lint script.
- Existing test results do not establish full browser E2E coverage.

## 10. Updating this guide

When adding or moving tests:
- Update the relevant domain row in the test index.
- Keep commands aligned with actual package scripts and test configuration.
- Do not hardcode test counts here; test counts belong in execution evidence in `roadmap.md`.
- Keep feature-specific acceptance criteria in `roadmap.md`, not duplicated in this guide.

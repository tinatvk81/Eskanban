# ADR-0008: Database and tenant isolation

- Status: Proposed
- Date: 2026-10-08

## Context
ADR-0005 requires strict isolation between agencies. Agencies hold sensitive client and deal data,
and a leak between tenants would be the worst failure the product can have.

## Decision
- PostgreSQL with SQLAlchemy 2.x (synchronous) and psycopg 3; schema changes only through Alembic.
- Hosting URLs (`postgres://`, `postgresql://`) are normalised to `postgresql+psycopg://`.
- Enums are stored as VARCHAR with named CHECK constraints (not native enum types), which keeps migrations simple.
- Tenant-owned tables carry `agency_id` through `TenantMixin`.
- Isolation is enforced in the session (`app/db/tenancy.py`):
  - tenant scope filters every ORM select/update/delete and stamps `agency_id` on new rows;
  - writing another agency's data, or moving a row between agencies, raises `TenantViolation`;
  - a session without scope fails closed (no rows, no writes);
  - `SYSTEM` scope is explicit and reserved for provisioning, migrations and workers.
- Seat limits and the "last manager" rule live in the service layer and run under a row lock on the agency.
- Emails are unique across the platform, case-insensitively.
- PostgreSQL row-level security (RLS) is a planned second layer, deferred until the first real data table (Files)
  and until we know which database role the hosting provider gives us.

## Consequences
- Raw SQL and `Table`-based queries bypass the filter, so they are forbidden on tenant tables (`.claude/rules/tenancy.md`).
- Every new tenant table needs an isolation test; the existing tests were mutation-checked (they fail if scoping is removed).
- Tests need a real PostgreSQL; CI provides one as a service container.

## Lesson from the Files module (added 2026-10-10)
Testing the first aggregate query showed that the ORM filter did **not** scope one statement shape:
`select(func.count().filter(...))` without `select_from(Model)`. A manager of another agency saw a count
belonging to the first agency. It was fixed, and `tests/test_tenancy_statement_shapes.py` now runs every
shape we use against an agency that owns nothing (the leaking shape is kept as a strict expected failure).

What this means:
- Always name the table in aggregates (`select_from(Model)`) and add an explicit `agency_id` condition.
- The application-level filter is not enough on its own. **Row-level security in PostgreSQL stays the
  planned second layer** and is now the next hardening step. It needs a database role that is neither
  superuser nor `BYPASSRLS`; which role the hosting platform gives us is still to be confirmed.

## Alternatives considered
Schema-per-tenant or database-per-tenant (stronger isolation, much more operational work for many small agencies);
RLS only (strong, but depends on database permissions we have not confirmed); async SQLAlchemy (more complexity, no need yet).

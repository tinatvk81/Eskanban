# Tenancy rules (ADR-0005, ADR-0008)

- Tenant-owned tables MUST use `TenantMixin` (apps/api/app/db/models/mixins.py).
- Use `tenant_session(agency_id)` for request handling. `system_session()` is only for provisioning,
  migrations and background workers.
- Query through ORM entities. Never use `text()` or `Table` objects on tenant tables: they bypass scoping.
- Every new tenant table gets an isolation test next to `apps/api/tests/test_tenancy.py`.
- Business rules (seat limits, last manager) live in `app/services/`, not in routers.

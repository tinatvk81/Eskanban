# ADR-0005: Multi-tenancy and access model

- Status: Accepted
- Date: 2026-10-07

## Context
Agencies have a manager and a variable number of advisors. Each advisor works on different files and clients and needs a private workspace.

## Decision
- Tenant = agency; every tenant-owned row carries `tenant_id`, enforced in the data-access layer (and PostgreSQL row-level security as a hardening step).
- Roles: Manager (full agency access, reports) and Advisor (own workspace only).
- Items are private to their owner advisor unless the manager shares them.
- Pricing by seat count (Solo / Small Agency 2–5 / Large Agency 6+).

## Consequences
Tenant isolation must be tested from the first endpoint. Sharing and reassignment need explicit audit entries.

# ADR-0003: Single monorepo layout

- Status: Accepted
- Date: 2026-10-07

## Context
Frontend, backend, scraper and future AI/agent services belong to one product and one owner. The owner asked for a single new repository.

## Decision
One repository, polyglot, with `apps/` (web, api, scraper, agents), `packages/` (shared contracts), `infra/`, `docs/`. Each app owns its toolchain (npm for web, Python tooling for api/scraper). `apps/agents` is reserved now, built later.

## Consequences
Atomic cross-cutting changes and one history; CI must run per-app jobs; commit scopes identify the app.

## Alternatives considered
Separate repos per service — more overhead for a solo owner and harder to keep contracts in sync.

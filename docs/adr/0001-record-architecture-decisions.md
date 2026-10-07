# ADR-0001: Record architecture decisions

- Status: Accepted
- Date: 2026-10-07

## Context
Decisions are made over many sessions. Without a record they get re-debated and re-explained, which wastes time and tokens.

## Decision
Significant architecture decisions are recorded as ADRs in `docs/adr/` using `template.md`. `docs/context/project-context.md` holds the current summary and the decision index.

## Consequences
Small overhead per decision; a stable, searchable history. Changing a decision means a new ADR that supersedes the old one.

# ADR-0012: Split property vocabularies

- Status: Proposed
- Date: 2026-11-05

## Context
`AMENITIES` in `vocab.py` mixes three concepts: real amenities (elevator, parking, pool),
the condition of the unit (renovated, new_build, unused) and climate systems (package boiler,
radiators, split AC, evaporative cooler, fan coil, chiller). Clients ask for them separately
("new build with a package boiler"), and condition values overlap each other.

## Decision
Keep `amenities` for features only. Add two controlled arrays, `condition` and `heating_cooling`,
each with its own CHECK constraint, vocab list and filter parameter. Existing keys are unchanged;
a migration moves the matching keys out of `amenities`. `GET /api/v1/vocab` returns the new groups.

## Consequences
- Cleaner filters and UI groups; import from legacy data stays one-to-one because keys do not change.
- One migration plus tests; cheaper now than after real data exists.

## Alternatives considered
Group the existing list in the UI only (no migration, but filters and logic stay mixed).
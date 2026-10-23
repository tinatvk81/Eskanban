# ADR-0011: Property files data model

- Status: Proposed
- Date: 2026-10-10

## Context
The Files module is the MVP. The legacy app already encodes years of real agency practice (four deal
types, urgent flag, favorites, optimistic locking, soft delete, change history). Its model stored prices
in a JSON column, tags as JSON, one boolean per amenity, and a free-text "convertible" note. The owner
asked for a better design, plus: floor and total floors, land and built area, document type, direction,
occupancy and vacate date, per-file history, Jalali dates by default.

## Decision
**Tables** (all tenant-owned and isolated as in ADR-0008): `properties`, `property_favorites`,
`property_history`. Shared reference tables: `provinces`, `cities` (not tenant-owned).

**Property file.**
- Deal type: sale, presale, rent, mortgage. Status: active, inactive, closed (with `deal_date`).
- Prices are typed `BIGINT` columns in whole Toman (no JSON, no 32-bit overflow): `price_total`,
  `price_per_m2`, `deposit` (rent deposit or mortgage), `monthly_rent`, and `convertible_options`
  (a validated list of deposit/rent pairs). `sort_price` is a generated column used for sorting and the
  price filter (rent = monthly rent, otherwise total or deposit).
- Fields that do not belong to the deal type are cleared on save; for sale and presale the missing one of
  total / per-m2 is computed from the area.
- Areas: `land_area_m2` (عرصه) and `built_area_m2` (زیربنا); `main_area_m2` (built, else land) is generated.
- Also: property types (array, several allowed), floor, total floors, total units, Jalali build year,
  direction + corner flag, amenities (controlled keys) + free custom amenities, document type + note,
  ownership in dang (1–6, default 6), occupancy + vacate date, owner name and phone, contract end date,
  presale delivery date and payment terms, urgent flag with optional end date, notes, map link.
- Controlled lists (`app/domain/vocab.py`, served by `GET /api/v1/vocab` with Persian and English labels)
  are enforced by CHECK constraints. Changing a list means editing vocab.py and adding a migration.
- Document types: single-sheet deed, booklet deed, informal contract, endowment (waqf), other. The list
  should be confirmed against what the agency actually writes.

**Visibility.** A manager sees every file of the agency; an advisor sees own files plus files a manager
shared with the agency (read-only for them). Soft-deleted files (manager only) are invisible to everyone.
Invisible, foreign and unknown files all answer "not found". A manager can reassign a file.

**Concurrency and history.** Optimistic locking through a `version` column (409 on conflict, also under a
true race). Every create, update (with a from/to diff), status change, share, reassign and delete is
appended to `property_history`.

**Search.** Free text is matched against a normalised `search_text` (Persian digits, ی/ک, ZWNJ, both phone
forms), every word must match. No extension is required; add trigram indexes if lists get slow.

**Geography.** `provinces` and `cities` are seeded by migration from the MIT-licensed
`ahmadazizi/iran-cities` v3.0 (data of 2017). Districts stay free text, with autocomplete from the
agency's own earlier entries.

**Similar files.** The duplicate check searches the whole agency by owner phone or address, but shows only
advisor name, deal type and city for files the caller cannot see (no id, no owner data).

**Dates.** Stored as Gregorian dates. The UI shows Jalali by default and offers a per-user setting to show
Gregorian as well (settings page, later).

## Consequences
- Photos, Excel import/export, saved filters and the expiry-review workflow are separate steps. The
  columns `last_confirmed_at` and `review_due_at` are already there for the review workflow.
- City data may miss cities created after 2017; add them with a migration.
- A temporary password blocks all data endpoints until changed (server-side).
- Any new query on tenant tables must be written in a shape covered by
  `tests/test_tenancy_statement_shapes.py` (see ADR-0008).

## Alternatives considered
One JSONB `details` column for deal-specific fields (the legacy way: weaker filtering and no constraints);
a table per deal type (more joins for little gain); `pg_trgm` search (needs extension permissions we have
not confirmed on the hosting platform).

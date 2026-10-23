# Property files rules (ADR-0011)

- Go through `app/services/properties.py`; routers stay thin and never build queries.
- Visibility is `_visible_filter(actor)`. Do not write a second copy of it.
- Money is whole Toman in `BIGINT` columns. Never floats, never 32-bit integers.
- Dates are stored Gregorian; Jalali is a UI concern. Persian digits are normalised on input, not in the database.
- Controlled lists live in `app/domain/vocab.py`; changing one needs a migration that updates the CHECK constraint.
- Every state change writes a `property_history` entry (create, update with diff, status, share, reassign, delete).
- A manager-only action needs a Forbidden test for advisors; every file endpoint needs a cross-agency 404 test.
- Owner phone numbers are sensitive: show them only where the caller may see the file.

"""Global ingestion service: persist normalized listings into source_listings.

Scope (S2.2): upsert by (source, external_id), refresh last_seen_at and bring
listings back from Gone. It never touches listing_inbox and never commits;
the caller (CLI in S2.4 or a test) owns the transaction.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, fields
from datetime import UTC, datetime

from sqlalchemy import literal_column, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.models import SourceListing
from app.ingest.contracts import NormalizedListing

_KEY_FIELDS = ("source", "external_id")
_COLUMN_NAMES = set(SourceListing.__table__.c.keys())
_CONTENT_FIELDS = tuple(f.name for f in fields(NormalizedListing) if f.name in _COLUMN_NAMES)
# Normalized fields that have no matching column (must stay empty; tested).
UNMAPPED_FIELDS = tuple(f.name for f in fields(NormalizedListing) if f.name not in _COLUMN_NAMES)
# Policy A: the source is authoritative, so every content field is replaced on update.
_UPDATE_FIELDS = tuple(name for name in _CONTENT_FIELDS if name not in _KEY_FIELDS)


@dataclass(frozen=True, slots=True)
class IngestResult:
    seen: int
    created: int
    updated: int
    restored: int  # subset of `updated`: listings brought back from Gone


def _row(item: NormalizedListing) -> dict[str, object]:
    row: dict[str, object] = {}
    for name in _CONTENT_FIELDS:
        value = getattr(item, name)
        row[name] = list(value) if isinstance(value, tuple) else value
    return row


def ingest_listings(
    session: Session,
    listings: Iterable[NormalizedListing],
    *,
    now: datetime | None = None,
) -> IngestResult:
    """Upsert listings; the caller commits."""
    moment = now or datetime.now(UTC)
    seen = created = updated = restored = 0

    for item in listings:
        seen += 1
        was_gone = session.execute(
            select(SourceListing.is_gone).where(
                SourceListing.source == item.source,
                SourceListing.external_id == item.external_id,
            )
        ).scalar_one_or_none()

        stmt = insert(SourceListing).values(
            **_row(item),
            first_seen_at=moment,
            last_seen_at=moment,
            is_gone=False,
            gone_at=None,
        )
        update_values: dict[str, object] = {
            name: getattr(stmt.excluded, name) for name in _UPDATE_FIELDS
        }
        update_values.update(last_seen_at=moment, is_gone=False, gone_at=None)
        stmt = stmt.on_conflict_do_update(
            index_elements=list(_KEY_FIELDS), set_=update_values
        ).returning(literal_column("(xmax = 0)").label("inserted"))

        inserted = session.execute(stmt).scalar_one()
        if inserted:
            created += 1
        else:
            updated += 1
            if was_gone:
                restored += 1

    return IngestResult(seen=seen, created=created, updated=updated, restored=restored)

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, text

from app.db.models import ListingInbox, SourceListing
from app.ingest.contracts import NormalizedListing
from app.ingest.service import UNMAPPED_FIELDS, ingest_listings

T1 = datetime(2026, 11, 24, 10, 0, tzinfo=UTC)
T2 = T1 + timedelta(days=1)


def _item(**overrides) -> NormalizedListing:
    base = {
        "source": "divar",
        "external_id": "a1",
        "url": "https://divar.ir/v/a1",
        "title": "Old title",
        "price_total": 1_000_000,
        "property_types": ("apartment",),
    }
    base.update(overrides)
    return NormalizedListing(**base)


def _count(session) -> int:
    return session.scalar(select(func.count()).select_from(SourceListing))


def _get(session, external_id="a1") -> SourceListing:
    session.expire_all()
    return session.scalars(
        select(SourceListing).where(SourceListing.external_id == external_id)
    ).one()


@pytest.fixture
def clean(db):
    def _truncate():
        with db.begin() as conn:
            conn.execute(text("TRUNCATE listing_inbox, source_listings CASCADE"))

    _truncate()
    yield
    _truncate()


def test_every_normalized_field_maps_to_a_column():
    assert UNMAPPED_FIELDS == ()


def test_creates_new_listing(clean, system):
    result = ingest_listings(system, [_item()], now=T1)
    assert (result.seen, result.created, result.updated, result.restored) == (1, 1, 0, 0)
    row = _get(system)
    assert row.first_seen_at == T1 and row.last_seen_at == T1
    assert row.is_gone is False and row.gone_at is None


def test_updates_existing_listing_and_keeps_first_seen(clean, system):
    ingest_listings(system, [_item()], now=T1)
    result = ingest_listings(system, [_item(title="New title", price_total=2_000_000)], now=T2)
    assert (result.created, result.updated) == (0, 1)
    assert _count(system) == 1
    row = _get(system)
    assert row.title == "New title" and row.price_total == 2_000_000
    assert row.first_seen_at == T1 and row.last_seen_at == T2


def test_deduplicates_within_one_batch(clean, system):
    result = ingest_listings(system, [_item(), _item(title="Dup")], now=T1)
    assert (result.seen, result.created, result.updated) == (2, 1, 1)
    assert _count(system) == 1


def test_same_external_id_in_other_source_is_separate(clean, system):
    ingest_listings(system, [_item(), _item(source="sheypoor")], now=T1)
    assert _count(system) == 2


def test_gone_listing_is_restored_when_seen_again(clean, system):
    ingest_listings(system, [_item()], now=T1)
    row = _get(system)
    row.is_gone = True
    row.gone_at = T1
    system.flush()

    result = ingest_listings(system, [_item()], now=T2)
    assert (result.updated, result.restored) == (1, 1)
    row = _get(system)
    assert row.is_gone is False and row.gone_at is None and row.last_seen_at == T2


def test_ingestion_never_creates_inbox_rows(clean, system):
    ingest_listings(system, [_item(), _item(external_id="a2")], now=T1)
    assert system.scalar(select(func.count()).select_from(ListingInbox)) == 0

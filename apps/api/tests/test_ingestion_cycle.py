"""F7 S2.3: full ingestion cycle (raw fixture -> mapper -> service -> PostgreSQL)."""

import json
from collections.abc import Iterable
from dataclasses import fields
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from sqlalchemy import func, select

from app.db.models import ListingInbox, Plan, SourceListing
from app.ingest.contracts import NormalizedListing
from app.ingest.mapper import map_raw_listing
from app.ingest.service import IngestResult, ingest_listings
from app.services.agencies import create_agency
from tests.conftest import PASSWORD

FIXTURES = Path(__file__).parent / "fixtures" / "ingestion"
T1 = datetime(2026, 11, 24, 10, 0, tzinfo=UTC)
T2 = T1 + timedelta(days=1)


def load_raw() -> dict[str, object]:
    return json.loads((FIXTURES / "divar_listing.json").read_text(encoding="utf-8"))


class FakeConnector:
    """Offline connector: yields prepared raw records, no network, no database."""

    source_key = "divar"

    def __init__(self, records: Iterable[dict[str, object]]) -> None:
        self._records = list(records)

    def fetch_listings(self) -> Iterable[dict[str, object]]:
        return iter(self._records)


def run_cycle(session, connector: FakeConnector, *, now: datetime) -> IngestResult:
    items = [map_raw_listing(connector.source_key, raw) for raw in connector.fetch_listings()]
    return ingest_listings(session, items, now=now)


def _count(session, model) -> int:
    return session.scalar(select(func.count()).select_from(model))


def _get(session, external_id: str = "divar-test-1001") -> SourceListing:
    session.expire_all()
    return session.scalars(
        select(SourceListing).where(SourceListing.external_id == external_id)
    ).one()


def _assert_matches(row: SourceListing, expected: NormalizedListing) -> None:
    for f in fields(NormalizedListing):
        stored = getattr(row, f.name)
        wanted = getattr(expected, f.name)
        if isinstance(wanted, tuple):
            wanted = list(wanted)
        assert stored == wanted, f.name


def _make_agency(session):
    agency, _manager = create_agency(
        session,
        name="S23 Agency",
        slug="s23-agency",
        plan=Plan.SMALL,
        seat_limit=3,
        manager_phone="09121112233",
        manager_name="Test Manager",
        manager_password=PASSWORD,
    )
    return agency


def test_first_run_stores_fixture_exactly_as_mapped(ingestion_clean, system):
    raw = load_raw()
    expected = map_raw_listing("divar", raw)

    result = run_cycle(system, FakeConnector([raw]), now=T1)

    assert result == IngestResult(seen=1, created=1, updated=0, restored=0)
    row = _get(system)
    _assert_matches(row, expected)
    assert row.price_total is not None and row.price_total > 0
    assert row.posted_at == date(2026, 11, 20)
    assert row.first_seen_at == T1 and row.last_seen_at == T1
    assert row.is_gone is False and row.gone_at is None


def test_second_run_updates_same_row_in_place(ingestion_clean, system):
    raw = load_raw()
    run_cycle(system, FakeConnector([raw]), now=T1)
    first_id = _get(system).id

    changed = {**raw, "title": "آپارتمان سه خوابه", "price_total": "13000000000"}
    result = run_cycle(system, FakeConnector([changed]), now=T2)

    assert (result.created, result.updated, result.restored) == (0, 1, 0)
    assert _count(system, SourceListing) == 1
    row = _get(system)
    assert row.id == first_id
    assert row.title == "آپارتمان سه خوابه"
    assert row.price_total == 13_000_000_000
    assert row.first_seen_at == T1 and row.last_seen_at == T2


def test_unchanged_rerun_only_moves_last_seen(ingestion_clean, system):
    raw = load_raw()
    expected = map_raw_listing("divar", raw)
    run_cycle(system, FakeConnector([raw]), now=T1)

    result = run_cycle(system, FakeConnector([raw]), now=T2)

    assert (result.created, result.updated) == (0, 1)
    row = _get(system)
    _assert_matches(row, expected)
    assert row.first_seen_at == T1 and row.last_seen_at == T2


def test_duplicate_records_in_one_run_store_one_row(ingestion_clean, system):
    raw = load_raw()

    result = run_cycle(system, FakeConnector([raw, raw]), now=T1)

    assert (result.seen, result.created, result.updated) == (2, 1, 1)
    assert _count(system, SourceListing) == 1


def test_gone_listing_returns_through_full_cycle(ingestion_clean, system):
    raw = load_raw()
    run_cycle(system, FakeConnector([raw]), now=T1)
    row = _get(system)
    row.is_gone = True
    row.gone_at = T1
    system.flush()

    result = run_cycle(system, FakeConnector([raw]), now=T2)

    assert (result.updated, result.restored) == (1, 1)
    row = _get(system)
    assert row.is_gone is False and row.gone_at is None
    assert row.last_seen_at == T2


def test_existing_inbox_rows_survive_and_none_are_created(ingestion_clean, system):
    agency = _make_agency(system)
    raw = load_raw()
    run_cycle(system, FakeConnector([raw]), now=T1)
    assert _count(system, ListingInbox) == 0  # ingestion alone never creates inbox rows

    listing = _get(system)
    system.add(ListingInbox(agency_id=agency.id, source_listing_id=listing.id, status="converted"))
    system.flush()

    changed = {**raw, "title": "عنوان جدید"}
    other = {
        **raw,
        "external_id": "divar-test-1002",
        "url": "https://divar.ir/v/test-1002",
    }
    run_cycle(system, FakeConnector([changed, other]), now=T2)

    assert _count(system, SourceListing) == 2
    assert _count(system, ListingInbox) == 1  # no new inbox row for the new listing
    inbox = system.scalars(select(ListingInbox)).one()
    assert inbox.status == "converted"
    assert inbox.source_listing_id == listing.id
    assert inbox.agency_id == agency.id

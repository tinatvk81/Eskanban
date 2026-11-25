"""Run one source ingestion (F7 S2.4).

Gates, in order: the global kill switch (ESKANBAN_INGESTION_ENABLED), the source
is known and ENABLED in app/domain/sources.py, a connector is registered in
app/ingest/registry.py. All-or-nothing: every raw record is fetched and mapped
before the first database write, so a bad record or a failing connector leaves
the database untouched. The caller owns the transaction (commit or rollback).
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import DomainError, InvalidInput
from app.domain import sources as source_registry
from app.domain.sources import SourceStatus
from app.ingest.contracts import NormalizedListing
from app.ingest.mapper import map_raw_listing
from app.ingest.registry import CONNECTORS, ConnectorFactory
from app.ingest.service import IngestResult, ingest_listings


class IngestionDisabled(DomainError):
    code = "ingestion_disabled"


class SourceNotEnabled(DomainError):
    code = "source_not_enabled"


class ConnectorMissing(DomainError):
    code = "connector_missing"


class ConnectorFailed(DomainError):
    code = "connector_failed"


def _fetch_and_map(source_key: str, factory: ConnectorFactory) -> list[NormalizedListing]:
    try:
        connector = factory()
        raw_records = list(connector.fetch_listings())
    except DomainError:
        raise
    except Exception as exc:
        raise ConnectorFailed(f"{type(exc).__name__}: {exc}") from exc

    if connector.source_key != source_key:
        raise ConnectorFailed(
            f"connector reports source '{connector.source_key}', expected '{source_key}'"
        )

    items: list[NormalizedListing] = []
    for index, raw in enumerate(raw_records, start=1):
        try:
            items.append(map_raw_listing(source_key, raw))
        except (ValueError, TypeError) as exc:
            raise InvalidInput(f"record {index}: {exc}") from exc
    return items


def run_source(session: Session, source_key: str) -> IngestResult:
    """Ingest one source into source_listings. Does not commit."""
    if not get_settings().ingestion_enabled:
        raise IngestionDisabled(
            "source ingestion is switched off (set ESKANBAN_INGESTION_ENABLED=true)"
        )

    info = source_registry.get(source_key)
    if info is None:
        raise InvalidInput(f"unknown source '{source_key}'")
    if info.status != SourceStatus.ENABLED:
        raise SourceNotEnabled(f"source '{source_key}' is {info.status.value}, not enabled")

    factory = CONNECTORS.get(source_key)
    if factory is None:
        raise ConnectorMissing(f"no connector is registered for source '{source_key}'")

    return ingest_listings(session, _fetch_and_map(source_key, factory))

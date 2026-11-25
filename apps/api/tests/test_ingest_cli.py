"""F7 S2.4: `ingest` CLI, kill switch and ENABLED gate (offline, isolated PostgreSQL)."""

import dataclasses
import getpass
import json
from collections.abc import Iterable
from pathlib import Path

import pytest
from sqlalchemy import func, select

from app import cli
from app.core.config import get_settings
from app.db.models import SourceListing
from app.db.session import system_session
from app.domain import sources as source_registry
from app.domain.sources import SourceStatus
from app.ingest import registry

FIXTURE = Path(__file__).parent / "fixtures" / "ingestion" / "divar_listing.json"
ARGS = ["ingest", "--source", "divar"]


def _raw() -> dict[str, object]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


class FakeConnector:
    def __init__(
        self,
        records: Iterable[dict[str, object]],
        *,
        source_key: str = "divar",
        error: Exception | None = None,
    ) -> None:
        self.source_key = source_key
        self._records = list(records)
        self._error = error

    def fetch_listings(self) -> Iterable[dict[str, object]]:
        if self._error is not None:
            raise self._error
        return iter(self._records)


def _prepare(
    monkeypatch,
    db,
    *,
    switch: bool = True,
    status: SourceStatus = SourceStatus.ENABLED,
    connector: FakeConnector | None = None,
) -> None:
    monkeypatch.setattr("app.db.session.get_engine", lambda: db)
    monkeypatch.setattr(
        getpass, "getpass", lambda prompt="": pytest.fail("ingest must not ask for a password")
    )
    real = get_settings()
    monkeypatch.setattr(
        "app.ingest.runner.get_settings",
        lambda: real.model_copy(update={"ingestion_enabled": switch}),
    )
    monkeypatch.setitem(
        source_registry._BY_KEY,
        "divar",
        dataclasses.replace(source_registry.get("divar"), status=status),
    )
    if connector is not None:
        monkeypatch.setitem(registry.CONNECTORS, "divar", lambda: connector)


def _count(db) -> int:
    with system_session(engine=db) as session:
        return session.scalar(select(func.count()).select_from(SourceListing))


def test_kill_switch_off_blocks_everything(monkeypatch, db, ingestion_clean, capsys):
    _prepare(monkeypatch, db, switch=False, connector=FakeConnector([_raw()]))
    assert cli.main(ARGS) == 1
    assert "ingestion_disabled" in capsys.readouterr().err
    assert _count(db) == 0


def test_unknown_source_is_rejected(monkeypatch, db, ingestion_clean, capsys):
    _prepare(monkeypatch, db)
    assert cli.main(["ingest", "--source", "nosuch"]) == 1
    assert "invalid_input" in capsys.readouterr().err


def test_planned_source_is_refused(monkeypatch, db, ingestion_clean, capsys):
    _prepare(monkeypatch, db, status=SourceStatus.PLANNED, connector=FakeConnector([_raw()]))
    assert cli.main(ARGS) == 1
    assert "source_not_enabled" in capsys.readouterr().err
    assert _count(db) == 0


def test_enabled_source_without_connector(monkeypatch, db, ingestion_clean, capsys):
    _prepare(monkeypatch, db)
    assert cli.main(ARGS) == 1
    assert "connector_missing" in capsys.readouterr().err


def test_success_stores_commits_and_asks_no_password(monkeypatch, db, ingestion_clean, capsys):
    _prepare(monkeypatch, db, connector=FakeConnector([_raw()]))
    assert cli.main(ARGS) == 0
    assert "created=1" in capsys.readouterr().out
    assert _count(db) == 1


def test_second_run_updates_instead_of_duplicating(monkeypatch, db, ingestion_clean, capsys):
    _prepare(monkeypatch, db, connector=FakeConnector([_raw()]))
    assert cli.main(ARGS) == 0
    capsys.readouterr()
    assert cli.main(ARGS) == 0
    out = capsys.readouterr().out
    assert "created=0" in out and "updated=1" in out
    assert _count(db) == 1


def test_bad_record_rolls_back_the_whole_run(monkeypatch, db, ingestion_clean, capsys):
    bad = {"external_id": "no-url-here"}
    _prepare(monkeypatch, db, connector=FakeConnector([_raw(), bad]))
    assert cli.main(ARGS) == 1
    err = capsys.readouterr().err
    assert "invalid_input" in err and "record 2" in err
    assert _count(db) == 0


def test_connector_error_is_reported_and_stores_nothing(monkeypatch, db, ingestion_clean, capsys):
    _prepare(monkeypatch, db, connector=FakeConnector([], error=ConnectionError("boom")))
    assert cli.main(ARGS) == 1
    err = capsys.readouterr().err
    assert "connector_failed" in err and "boom" in err
    assert _count(db) == 0


def test_connector_with_wrong_source_key_is_refused(monkeypatch, db, ingestion_clean, capsys):
    _prepare(monkeypatch, db, connector=FakeConnector([_raw()], source_key="sheypoor"))
    assert cli.main(ARGS) == 1
    assert "connector_failed" in capsys.readouterr().err
    assert _count(db) == 0

"""Migration 0004 on real old-shaped data, in a throw-away database.

upgrade to 0003 -> insert files in the OLD document model -> upgrade to 0004 -> check the mapping
-> downgrade -> check the reverse mapping.
"""

import os
import uuid

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError

from alembic import command
from tests.conftest import ROOT, TEST_URL

TEMP_DB = f"eskanban_mig0004_{os.getpid()}"


@pytest.fixture
def temp_db_url():
    base = make_url(TEST_URL)
    admin = create_engine(base.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{TEMP_DB}"'))
            conn.execute(text(f'CREATE DATABASE "{TEMP_DB}"'))
    except (OperationalError, ProgrammingError):
        admin.dispose()
        if os.getenv("CI"):
            raise
        pytest.skip("cannot create a temporary database")
    try:
        yield base.set(database=TEMP_DB).render_as_string(hide_password=False)
    finally:
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{TEMP_DB}" WITH (FORCE)'))
        admin.dispose()


def _cfg(url: str) -> Config:
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    return cfg


def _insert_file(conn, agency_id, user_id, document_type, dang=6):
    pid = uuid.uuid4()
    conn.execute(
        text(
            "INSERT INTO properties (id, agency_id, owner_user_id, deal_type, city_id, "
            "document_type, ownership_dang) "
            "VALUES (:id, :a, :u, 'sale', 1, :d, :g)"
        ),
        {"id": pid, "a": agency_id, "u": user_id, "d": document_type, "g": dang},
    )
    return pid


def _row(conn, pid):
    return conn.execute(
        text(
            "SELECT document_type, ownership_kind, deed_scope, is_divided, ownership_dang "
            "FROM properties WHERE id = :id"
        ),
        {"id": pid},
    ).one()


def test_data_is_mapped_up_and_back(temp_db_url):
    cfg = _cfg(temp_db_url)
    command.upgrade(cfg, "0003")
    eng = create_engine(temp_db_url)
    agency, user = uuid.uuid4(), uuid.uuid4()
    with eng.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO agencies (id, name, slug, plan, seat_limit) "
                "VALUES (:id, 'A', 'a', 'solo', 1)"
            ),
            {"id": agency},
        )
        conn.execute(
            text(
                "INSERT INTO users (id, agency_id, phone, full_name, role) "
                "VALUES (:id, :a, '+989121112233', 'U', 'manager')"
            ),
            {"id": user, "a": agency},
        )
        ids = {
            name: _insert_file(conn, agency, user, doc, dang)
            for name, doc, dang in (
                ("qolnameh", "qolnameh", 6),
                ("waqfi", "waqfi", 6),
                ("tak_barg", "tak_barg", 3),
                ("mangoole_dar", "mangoole_dar", 6),
                ("other", "other", 6),
                ("none", None, 6),
            )
        }

    command.upgrade(cfg, "0004")
    with eng.connect() as conn:
        rows = {name: _row(conn, pid) for name, pid in ids.items()}
    # (document_type, ownership_kind, deed_scope, is_divided, ownership_dang)
    assert rows["qolnameh"] == ("informal", None, None, None, 6)
    assert rows["waqfi"] == (None, "waqf", None, None, 6)  # waqf is not a document type
    assert rows["tak_barg"] == ("tak_barg", None, None, None, 3)  # untouched
    assert rows["mangoole_dar"] == ("mangoole_dar", None, None, None, 6)
    assert rows["other"] == ("other", None, None, None, 6)
    assert rows["none"] == (None, None, None, None, 6)

    # The new constraints are live.
    for bad in ("document_type = 'qolnameh'", "deed_scope = 'roof'", "ownership_kind = 'x'"):
        with pytest.raises(IntegrityError), eng.begin() as conn:
            conn.execute(text(f"UPDATE properties SET {bad} WHERE id = :id"), {"id": ids["none"]})

    # Some files get the new dimensions, then we go back.
    with eng.begin() as conn:
        conn.execute(
            text("UPDATE properties SET document_type = 'official' WHERE id = :id"),
            {"id": ids["none"]},
        )

    command.downgrade(cfg, "0003")
    with eng.connect() as conn:
        cols = {
            r[0]
            for r in conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = 'properties'"
                )
            )
        }
        back = {
            name: conn.execute(
                text("SELECT document_type FROM properties WHERE id = :id"), {"id": pid}
            ).scalar_one()
            for name, pid in ids.items()
        }
    assert not cols & {"is_divided", "deed_scope", "ownership_kind"}
    assert back["qolnameh"] == "qolnameh"
    assert back["waqfi"] == "waqfi"
    assert back["none"] == "other"  # 'official' did not exist before; the closest old value
    assert back["tak_barg"] == "tak_barg"

    # ...and forward again works (the migration is repeatable).
    command.upgrade(cfg, "0004")
    with eng.connect() as conn:
        assert _row(conn, ids["waqfi"])[:2] == (None, "waqf")
    eng.dispose()


def test_check_constraints_in_the_model_match_the_migrated_database(engine):
    """Alembic autogenerate does not compare CHECK constraints, so compare the names ourselves.

    A drift here means a model constraint was added or renamed without a migration (or vice versa).
    """
    from sqlalchemy import CheckConstraint

    from app.db.models import Property

    in_model = {c.name for c in Property.__table__.constraints if isinstance(c, CheckConstraint)}
    with engine.connect() as conn:
        in_db = {
            r[0]
            for r in conn.execute(
                text(
                    "SELECT conname FROM pg_constraint "
                    "WHERE conrelid = 'properties'::regclass AND contype = 'c'"
                )
            )
        }
    assert in_model == in_db

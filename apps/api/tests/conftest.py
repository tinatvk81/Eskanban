import itertools
import os
from pathlib import Path

import pytest
from alembic.config import Config
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

from alembic import command
from app.core import security
from app.db.models import Plan
from app.db.session import system_session
from app.db.url import normalize_database_url
from app.main import app
from app.services.agencies import create_agency

ROOT = Path(__file__).resolve().parents[1]
TEST_URL = normalize_database_url(
    os.getenv(
        "ESKANBAN_TEST_DATABASE_URL",
        "postgresql+psycopg://eskanban:eskanban@localhost:5432/eskanban_test",
    )
)
PASSWORD = "Test-pass-123"


@pytest.fixture(scope="session", autouse=True)
def _fast_password_hashing():
    """Cheap Argon2 parameters keep the suite fast; production uses the real ones."""
    original = security._hasher
    security._hasher = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)
    security._dummy_hash = None
    yield
    security._hasher = original
    security._dummy_hash = None


@pytest.fixture(scope="session")
def engine():
    """Test database with the real Alembic migrations applied (so migrations are tested too)."""
    eng = create_engine(TEST_URL)
    try:
        with eng.connect():
            pass
    except OperationalError:
        if os.getenv("CI"):
            raise  # in CI a missing database must fail, not skip
        pytest.skip("PostgreSQL test database not reachable (set ESKANBAN_TEST_DATABASE_URL)")

    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", TEST_URL.replace("%", "%%"))
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    yield eng
    command.downgrade(cfg, "base")
    eng.dispose()


@pytest.fixture
def db(engine):
    yield engine
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE auth_sessions, users, agencies CASCADE"))


@pytest.fixture
def system(db):
    with system_session(engine=db) as session:
        yield session


_phones = itertools.count(1)


def next_phone() -> str:
    return f"0912{next(_phones):07d}"


@pytest.fixture
def make_agency(db):
    """Create an agency (with its manager) and return a dict of ids and credentials."""

    def _make(
        slug: str,
        *,
        plan: Plan = Plan.SMALL,
        seats: int = 3,
        manager_phone: str | None = None,
        manager_email: str | None = None,
    ):
        phone = manager_phone or next_phone()
        with system_session(engine=db) as session:
            agency, manager = create_agency(
                session,
                name=f"Agency {slug}",
                slug=slug,
                plan=plan,
                seat_limit=seats,
                manager_phone=phone,
                manager_name="Manager",
                manager_password=PASSWORD,
                manager_email=manager_email,
            )
            session.commit()
            return {
                "agency_id": agency.id,
                "manager_id": manager.id,
                "phone": manager.phone,
                "password": PASSWORD,
            }

    return _make


@pytest.fixture
def client(db, monkeypatch):
    monkeypatch.setattr("app.db.session.get_engine", lambda: db)
    return TestClient(app)


def login(client: TestClient, phone: str, password: str = PASSWORD) -> str:
    res = client.post("/api/v1/auth/login", json={"phone": phone, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}

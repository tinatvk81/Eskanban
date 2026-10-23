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
        conn.execute(
            text(
                "TRUNCATE property_history, property_favorites, properties, "
                "auth_sessions, users, agencies CASCADE"
            )
        )


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
        must_change: bool = False,
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
            manager.must_change_password = must_change
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


@pytest.fixture
def make_advisor(db):
    """Add an advisor to an agency (made with make_agency) and return their credentials."""

    def _make(
        agency: dict, *, phone: str | None = None, name: str = "Advisor", must_change: bool = False
    ):
        from app.db.models import Role
        from app.db.session import tenant_session
        from app.services.agencies import add_user

        number = phone or next_phone()
        with tenant_session(agency["agency_id"], engine=db) as session:
            user = add_user(
                session, phone=number, full_name=name, role=Role.ADVISOR, password=PASSWORD
            )
            user.must_change_password = must_change
            session.commit()
            return {
                "user_id": user.id,
                "phone": user.phone,
                "password": PASSWORD,
                "agency_id": agency["agency_id"],
            }

    return _make


@pytest.fixture(scope="session")
def city_ids(engine):
    """Ids of a few seeded cities: mashhad, tehran, neyshabur."""
    from sqlalchemy import text

    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT name, id FROM cities WHERE name IN ('مشهد', 'تهران', 'نیشابور')")
        ).all()
    ids = {name: cid for name, cid in rows}
    return {"mashhad": ids["مشهد"], "tehran": ids["تهران"], "neyshabur": ids["نیشابور"]}


def clear_must_change(engine, phone: str) -> None:
    from sqlalchemy import text

    with engine.begin() as conn:
        conn.execute(
            text("UPDATE users SET must_change_password = false WHERE phone = :p"), {"p": phone}
        )


# ------------------------------------------------------------------ property helpers
def prop_values(city_id: int, **overrides):
    """A complete, valid payload for create/update, in the shape the service expects."""
    from app.schemas.properties import PropertyCreate

    data = {
        "deal_type": "sale",
        "city_id": city_id,
        "property_types": ["apartment"],
        "address": "بلوار وکیل‌آباد، وکیل‌آباد ۱۲",
        "built_area_m2": 100,
        "rooms": 2,
        "price_total": 5_000_000_000,
        "owner_name": "آقای احمدی",
        "owner_phone": "09121112233",
    }
    data.update(overrides)
    return PropertyCreate(**data).model_dump(exclude={"owner_user_id"})


def make_ctx(agency_id, user_id, role):
    import uuid

    from app.services.auth import AuthContext

    return AuthContext(
        user_id=user_id,
        agency_id=agency_id,
        role=role,
        session_id=uuid.uuid4(),
        must_change_password=False,
    )

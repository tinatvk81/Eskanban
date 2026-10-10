from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.db import session as db_session
from app.main import app

client = TestClient(app)


def test_ready_ok_when_database_reachable(monkeypatch):
    monkeypatch.setattr("app.api.v1.health.check_database", lambda: True)
    res = client.get("/api/v1/health/ready")
    assert res.status_code == 200
    assert res.json() == {"status": "ready", "database": "ok"}


def test_ready_503_when_database_down(monkeypatch):
    monkeypatch.setattr("app.api.v1.health.check_database", lambda: False)
    res = client.get("/api/v1/health/ready")
    assert res.status_code == 503


def test_check_database_true_with_real_database(engine, monkeypatch):
    monkeypatch.setattr(db_session, "get_engine", lambda: engine)
    assert db_session.check_database() is True


def test_check_database_false_when_unreachable(monkeypatch):
    dead = create_engine(
        "postgresql+psycopg://x:x@127.0.0.1:1/none", connect_args={"connect_timeout": 1}
    )
    monkeypatch.setattr(db_session, "get_engine", lambda: dead)
    assert db_session.check_database() is False

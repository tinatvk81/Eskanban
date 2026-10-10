import getpass

from sqlalchemy import select

from app import cli
from app.db.models import Agency, User
from app.db.session import system_session
from tests.conftest import auth, login


def _patch(monkeypatch, db, password="Cli-pass-1234"):
    monkeypatch.setattr("app.db.session.get_engine", lambda: db)
    monkeypatch.setattr(getpass, "getpass", lambda prompt="": password)


def test_create_agency_command(db, client, monkeypatch, capsys):
    _patch(monkeypatch, db)
    code = cli.main(
        [
            "create-agency", "--name", "CLI Realty", "--slug", "cli-realty", "--plan", "small",
            "--seats", "3", "--manager-name", "Op", "--manager-phone", "09121239999",
        ]
    )
    assert code == 0
    assert "cli-realty" in capsys.readouterr().out
    with system_session(engine=db) as s:
        assert s.scalar(select(Agency).where(Agency.slug == "cli-realty")) is not None
    token = login(client, "09121239999", "Cli-pass-1234")
    assert client.get("/api/v1/auth/me", headers=auth(token)).status_code == 200


def test_create_agency_reports_domain_errors(db, monkeypatch, capsys):
    _patch(monkeypatch, db)
    args = [
        "create-agency", "--name", "X", "--slug", "bad slug", "--plan", "solo",
        "--seats", "1", "--manager-name", "Op", "--manager-phone", "09121230000",
    ]
    assert cli.main(args) == 1
    assert "invalid_input" in capsys.readouterr().err


def test_password_mismatch_aborts(db, monkeypatch, capsys):
    monkeypatch.setattr("app.db.session.get_engine", lambda: db)
    answers = iter(["Cli-pass-1234", "different-pass"])
    monkeypatch.setattr(getpass, "getpass", lambda prompt="": next(answers))
    code = cli.main(
        [
            "create-agency", "--name", "X", "--slug", "mismatch", "--plan", "solo",
            "--seats", "1", "--manager-name", "Op", "--manager-phone", "09121230001",
        ]
    )
    assert code == 1
    with system_session(engine=db) as s:
        assert s.scalar(select(User)) is None


def test_set_password_command(db, client, make_agency, monkeypatch):
    info = make_agency("cli-reset")
    _patch(monkeypatch, db, password="Fresh-pass-5678")
    assert cli.main(["set-password", "--phone", info["phone"]]) == 0
    assert login(client, info["phone"], "Fresh-pass-5678")


def test_set_password_unknown_phone(db, monkeypatch, capsys):
    _patch(monkeypatch, db)
    assert cli.main(["set-password", "--phone", "09129998888"]) == 1
    assert "invalid_input" in capsys.readouterr().err

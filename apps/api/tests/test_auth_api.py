from app.core.config import get_settings
from tests.conftest import PASSWORD, auth, login


def test_login_returns_token_and_user(client, make_agency):
    info = make_agency("api-login")
    res = client.post("/api/v1/auth/login", json={"phone": info["phone"], "password": PASSWORD})
    assert res.status_code == 200
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"].startswith("esk_")
    assert body["must_change_password"] is True
    assert body["user"]["role"] == "manager"
    assert "password_hash" not in body["user"]
    assert res.headers["cache-control"] == "no-store"


def test_login_with_persian_digits(client, make_agency):
    info = make_agency("api-persian", manager_phone="09127778899")
    res = client.post(
        "/api/v1/auth/login", json={"phone": "۰۹۱۲۷۷۷۸۸۹۹", "password": PASSWORD}
    )
    assert res.status_code == 200, res.text
    assert info["phone"] == "+989127778899"


def test_me_returns_user_and_agency(client, make_agency):
    info = make_agency("api-me")
    res = client.get("/api/v1/auth/me", headers=auth(login(client, info["phone"])))
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["phone"] == info["phone"]
    assert body["agency"]["slug"] == "api-me"
    assert body["agency"]["seat_limit"] == 3


def test_missing_or_bad_token_is_401(client):
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401
    assert res.headers["www-authenticate"] == "Bearer"
    assert res.json()["error"]["code"] == "not_authenticated"
    bad = client.get("/api/v1/auth/me", headers=auth("esk_not-a-real-token"))
    assert bad.status_code == 401
    assert client.get("/api/v1/auth/me", headers={"Authorization": "Basic abc"}).status_code == 401


def test_wrong_password_and_unknown_phone_look_identical(client, make_agency):
    info = make_agency("api-enum")
    wrong = client.post("/api/v1/auth/login", json={"phone": info["phone"], "password": "nope"})
    unknown = client.post(
        "/api/v1/auth/login", json={"phone": "09120000999", "password": "nope"}
    )
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_lockout_returns_429_with_retry_after(client, make_agency):
    info = make_agency("api-lock")
    for _ in range(get_settings().max_failed_logins):
        res = client.post("/api/v1/auth/login", json={"phone": info["phone"], "password": "bad"})
        assert res.status_code == 401
    locked = client.post(
        "/api/v1/auth/login", json={"phone": info["phone"], "password": PASSWORD}
    )
    assert locked.status_code == 429
    assert locked.json()["error"]["code"] == "account_locked"
    assert int(locked.headers["retry-after"]) > 0


def test_logout_ends_the_session(client, make_agency):
    info = make_agency("api-logout")
    token = login(client, info["phone"])
    assert client.post("/api/v1/auth/logout", headers=auth(token)).status_code == 204
    assert client.get("/api/v1/auth/me", headers=auth(token)).status_code == 401


def test_change_password_flow(client, make_agency):
    info = make_agency("api-change")
    current = login(client, info["phone"])
    other = login(client, info["phone"])

    wrong = client.post(
        "/api/v1/auth/change-password",
        headers=auth(current),
        json={"current_password": "nope", "new_password": "New-pass-456"},
    )
    assert wrong.status_code == 400 and wrong.json()["error"]["code"] == "wrong_password"

    weak = client.post(
        "/api/v1/auth/change-password",
        headers=auth(current),
        json={"current_password": PASSWORD, "new_password": "12345678"},
    )
    assert weak.status_code == 422 and weak.json()["error"]["code"] == "weak_password"

    ok = client.post(
        "/api/v1/auth/change-password",
        headers=auth(current),
        json={"current_password": PASSWORD, "new_password": "New-pass-456"},
    )
    assert ok.status_code == 204
    assert client.get("/api/v1/auth/me", headers=auth(current)).status_code == 200
    assert client.get("/api/v1/auth/me", headers=auth(other)).status_code == 401
    assert client.get("/api/v1/auth/me", headers=auth(current)).json()["user"][
        "must_change_password"
    ] is False
    assert login(client, info["phone"], "New-pass-456")


def test_login_validation_errors_are_422(client):
    assert client.post("/api/v1/auth/login", json={"phone": "x"}).status_code == 422

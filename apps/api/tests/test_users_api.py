import uuid

from tests.conftest import PASSWORD, auth, login


def _create_user(client, token, phone, role="advisor", **extra):
    return client.post(
        "/api/v1/users",
        headers=auth(token),
        json={"full_name": "New Person", "phone": phone, "role": role, "password": PASSWORD}
        | extra,
    )


def test_manager_creates_advisor_who_must_change_password(client, make_agency):
    info = make_agency("u-create", seats=3)
    manager = login(client, info["phone"])
    res = _create_user(client, manager, "09128880001")
    assert res.status_code == 201
    assert res.json()["phone"] == "+989128880001"
    assert res.json()["must_change_password"] is True

    advisor_login = client.post(
        "/api/v1/auth/login", json={"phone": "09128880001", "password": PASSWORD}
    )
    assert advisor_login.status_code == 200
    assert advisor_login.json()["must_change_password"] is True


def test_advisor_cannot_manage_users(client, make_agency):
    info = make_agency("u-rbac", seats=3)
    manager = login(client, info["phone"])
    _create_user(client, manager, "09128880002")
    advisor = login(client, "09128880002")

    assert client.get("/api/v1/users", headers=auth(advisor)).status_code == 403
    assert _create_user(client, advisor, "09128880003").status_code == 403
    me = client.get("/api/v1/auth/me", headers=auth(advisor))
    assert me.status_code == 200  # but advisors can use their own profile


def test_users_require_authentication(client):
    assert client.get("/api/v1/users").status_code == 401


def test_seat_limit_over_http(client, make_agency):
    info = make_agency("u-seats", seats=2)
    manager = login(client, info["phone"])
    assert _create_user(client, manager, "09128880004").status_code == 201
    res = _create_user(client, manager, "09128880005")
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "seat_limit_reached"


def test_duplicate_phone_is_409_even_across_agencies(client, make_agency):
    a = make_agency("u-dup-a", seats=3)
    b = make_agency("u-dup-b", seats=3)
    token_b = login(client, b["phone"])
    res = _create_user(client, token_b, a["phone"])
    assert res.status_code == 409 and res.json()["error"]["code"] == "phone_taken"


def test_invalid_input_is_422(client, make_agency):
    info = make_agency("u-invalid", seats=3)
    token = login(client, info["phone"])
    bad_phone = _create_user(client, token, "12345")
    assert bad_phone.status_code == 422 and bad_phone.json()["error"]["code"] == "invalid_input"
    weak = _create_user(client, token, "09128880006", password="12345678")
    assert weak.status_code == 422 and weak.json()["error"]["code"] == "weak_password"


def test_each_manager_sees_only_their_own_agency(client, make_agency):
    a = make_agency("u-iso-a", seats=3)
    b = make_agency("u-iso-b", seats=3)
    token_a, token_b = login(client, a["phone"]), login(client, b["phone"])
    _create_user(client, token_a, "09128880007")

    listed_a = client.get("/api/v1/users", headers=auth(token_a)).json()
    listed_b = client.get("/api/v1/users", headers=auth(token_b)).json()
    assert len(listed_a) == 2 and len(listed_b) == 1
    assert {u["phone"] for u in listed_a}.isdisjoint({u["phone"] for u in listed_b})

    # B cannot touch A's people, and learns nothing about whether they exist
    victim = next(u for u in listed_a if u["phone"] != a["phone"])["id"]
    assert (
        client.post(f"/api/v1/users/{victim}/deactivate", headers=auth(token_b)).status_code == 404
    )
    assert (
        client.post(
            f"/api/v1/users/{victim}/reset-password",
            headers=auth(token_b),
            json={"new_password": "Hacked-pass-1"},
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/users/{uuid.uuid4()}/deactivate", headers=auth(token_b)
        ).status_code
        == 404
    )


def test_deactivation_ends_access_and_last_manager_is_protected(client, make_agency):
    info = make_agency("u-deact", seats=3)
    manager = login(client, info["phone"])
    created = _create_user(client, manager, "09128880008").json()
    advisor = login(client, "09128880008")

    assert (
        client.post(f"/api/v1/users/{created['id']}/deactivate", headers=auth(manager)).status_code
        == 200
    )
    assert client.get("/api/v1/auth/me", headers=auth(advisor)).status_code == 401
    assert (
        client.post(
            "/api/v1/auth/login", json={"phone": "09128880008", "password": PASSWORD}
        ).status_code
        == 401
    )

    me = client.get("/api/v1/auth/me", headers=auth(manager)).json()
    res = client.post(f"/api/v1/users/{me['user']['id']}/deactivate", headers=auth(manager))
    assert res.status_code == 409 and res.json()["error"]["code"] == "last_manager"


def test_reset_password_by_manager(client, make_agency):
    info = make_agency("u-reset", seats=3)
    manager = login(client, info["phone"])
    created = _create_user(client, manager, "09128880009").json()
    old_session = login(client, "09128880009")

    res = client.post(
        f"/api/v1/users/{created['id']}/reset-password",
        headers=auth(manager),
        json={"new_password": "Temp-pass-789"},
    )
    assert res.status_code == 200 and res.json()["must_change_password"] is True
    assert client.get("/api/v1/auth/me", headers=auth(old_session)).status_code == 401
    assert (
        client.post(
            "/api/v1/auth/login", json={"phone": "09128880009", "password": PASSWORD}
        ).status_code
        == 401
    )
    assert login(client, "09128880009", "Temp-pass-789")

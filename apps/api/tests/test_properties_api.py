import uuid

import pytest

from tests.conftest import auth, clear_must_change, login, next_phone

BASE = "/api/v1/properties"


def body(city_id, **overrides):
    data = {
        "deal_type": "sale",
        "city_id": city_id,
        "property_types": ["apartment"],
        "district": "وکیل‌آباد",
        "address": "بلوار وکیل‌آباد",
        "built_area_m2": 100,
        "rooms": 2,
        "price_total": 5_200_000_000,
        "owner_name": "آقای احمدی",
        "owner_phone": "09121112233",
    }
    data.update(overrides)
    return data


@pytest.fixture
def team(client, make_agency, make_advisor):
    """A manager and two advisors with tokens, plus a second agency's manager."""
    agency = make_agency(
        "api-files", plan=__import__("app.db.models", fromlist=["Plan"]).Plan.LARGE, seats=8
    )
    adv1 = make_advisor(agency, name="Advisor One")
    adv2 = make_advisor(agency, name="Advisor Two")
    other = make_agency("api-files-b", seats=3)
    return {
        "manager": login(client, agency["phone"]),
        "adv1": login(client, adv1["phone"]),
        "adv2": login(client, adv2["phone"]),
        "other": login(client, other["phone"]),
        "adv1_id": str(adv1["user_id"]),
        "adv2_id": str(adv2["user_id"]),
    }


def create(client, token, city_id, **overrides):
    res = client.post(BASE, headers=auth(token), json=body(city_id, **overrides))
    assert res.status_code == 201, res.text
    return res.json()


# --------------------------------------------------------------------------- create / read
def test_create_returns_the_full_file(client, team, city_ids):
    data = create(client, team["adv1"], city_ids["mashhad"], price_total=25_000_000_000)
    assert data["version"] == 1 and data["status"] == "active" and data["can_edit"] is True
    assert data["city"]["name"] == "مشهد" and data["city"]["province_name"] == "خراسان رضوی"
    assert data["owner"]["full_name"] == "Advisor One"
    assert data["price_total"] == 25_000_000_000 and data["price_per_m2"] == 250_000_000
    assert data["built_area_m2"] == 100.0 and data["main_area_m2"] == 100.0  # numbers, not strings
    assert data["owner_phone"] == "+989121112233" and data["is_favorite"] is False
    assert data["is_urgent_now"] is False and data["shared_with_agency"] is False
    assert "agency_id" not in data


def test_validation_errors_are_422(client, team, city_ids):
    for bad in (
        {"deal_type": "barter"},
        {"amenities": ["helipad"]},
        {"price_total": -1},
        {"ownership_dang": 9},
        {"location_url": "ftp://x"},
    ):
        res = client.post(BASE, headers=auth(team["adv1"]), json=body(city_ids["mashhad"], **bad))
        assert res.status_code == 422, bad
    unknown_city = client.post(BASE, headers=auth(team["adv1"]), json=body(99999999))
    assert (
        unknown_city.status_code == 422 and unknown_city.json()["error"]["code"] == "city_not_found"
    )
    bad_phone = client.post(
        BASE, headers=auth(team["adv1"]), json=body(city_ids["mashhad"], owner_phone="12")
    )
    assert bad_phone.status_code == 422 and bad_phone.json()["error"]["code"] == "invalid_input"


def test_authentication_is_required(client):
    assert client.get(BASE).status_code == 401
    assert client.post(BASE, json={}).status_code == 401
    assert client.get(f"{BASE}/{uuid.uuid4()}").status_code == 401


# --------------------------------------------------------------------------- visibility and roles
def test_advisors_only_see_their_own_files_and_manager_sees_all(client, team, city_ids):
    a = create(client, team["adv1"], city_ids["mashhad"], address="one")
    b = create(client, team["adv2"], city_ids["mashhad"], address="two")

    def ids(token):
        return {i["id"] for i in client.get(BASE, headers=auth(token)).json()["items"]}

    assert ids(team["adv1"]) == {a["id"]} and ids(team["adv2"]) == {b["id"]}
    assert ids(team["manager"]) == {a["id"], b["id"]} and ids(team["other"]) == set()
    assert client.get(f"{BASE}/{b['id']}", headers=auth(team["adv1"])).status_code == 404
    assert client.get(f"{BASE}/{b['id']}", headers=auth(team["other"])).status_code == 404
    assert client.get(f"{BASE}/{uuid.uuid4()}", headers=auth(team["adv1"])).status_code == 404


def test_manager_only_endpoints(client, team, city_ids):
    f = create(client, team["adv1"], city_ids["mashhad"])
    for path, payload in (
        (f"{BASE}/{f['id']}/share", {"shared": True}),
        (f"{BASE}/{f['id']}/reassign", {"owner_user_id": team["adv2_id"]}),
        (f"{BASE}/{f['id']}/soft-delete", None),
    ):
        res = client.post(path, headers=auth(team["adv1"]), json=payload)
        assert res.status_code == 403, path
        assert res.json()["error"]["code"] == "forbidden"


def test_sharing_flow_over_http(client, team, city_ids):
    f = create(client, team["adv1"], city_ids["mashhad"])
    shared = client.post(
        f"{BASE}/{f['id']}/share", headers=auth(team["manager"]), json={"shared": True}
    )
    assert shared.status_code == 200 and shared.json()["shared_with_agency"] is True

    seen = client.get(f"{BASE}/{f['id']}", headers=auth(team["adv2"]))
    assert seen.status_code == 200 and seen.json()["can_edit"] is False
    put = client.put(
        f"{BASE}/{f['id']}",
        headers=auth(team["adv2"]),
        json=body(city_ids["mashhad"]) | {"version": 1},
    )
    assert put.status_code == 403
    assert (
        client.post(
            f"{BASE}/{f['id']}/status", headers=auth(team["adv2"]), json={"status": "closed"}
        ).status_code
        == 403
    )
    listed = client.get(BASE, headers=auth(team["adv2"])).json()["items"]
    assert [i["id"] for i in listed] == [f["id"]]


def test_reassign_and_manager_creating_for_an_advisor(client, team, city_ids):
    f = create(client, team["adv1"], city_ids["mashhad"])
    moved = client.post(
        f"{BASE}/{f['id']}/reassign",
        headers=auth(team["manager"]),
        json={"owner_user_id": team["adv2_id"]},
    )
    assert moved.status_code == 200 and moved.json()["owner"]["full_name"] == "Advisor Two"
    assert client.get(f"{BASE}/{f['id']}", headers=auth(team["adv1"])).status_code == 404

    made = client.post(
        BASE,
        headers=auth(team["manager"]),
        json=body(city_ids["mashhad"]) | {"owner_user_id": team["adv1_id"]},
    )
    assert made.status_code == 201 and made.json()["owner"]["full_name"] == "Advisor One"
    denied = client.post(
        BASE,
        headers=auth(team["adv1"]),
        json=body(city_ids["mashhad"]) | {"owner_user_id": team["adv2_id"]},
    )
    assert denied.status_code == 403


def test_soft_delete_hides_the_file_for_everyone(client, team, city_ids):
    f = create(client, team["adv1"], city_ids["mashhad"])
    assert (
        client.post(f"{BASE}/{f['id']}/soft-delete", headers=auth(team["manager"])).status_code
        == 204
    )
    for token in ("manager", "adv1"):
        assert client.get(f"{BASE}/{f['id']}", headers=auth(team[token])).status_code == 404
        assert (
            client.post(
                f"{BASE}/{f['id']}/status", headers=auth(team[token]), json={"status": "active"}
            ).status_code
            == 404
        )
        assert client.get(BASE + "?status=any", headers=auth(team[token])).json()["total"] == 0


# --------------------------------------------------------------------------- update and versions
def test_update_flow_and_version_conflict(client, team, city_ids):
    f = create(client, team["adv1"], city_ids["mashhad"])
    ok = client.put(
        f"{BASE}/{f['id']}",
        headers=auth(team["adv1"]),
        json=body(city_ids["mashhad"], rooms=3) | {"version": 1},
    )
    assert ok.status_code == 200 and ok.json()["version"] == 2 and ok.json()["rooms"] == 3

    stale = client.put(
        f"{BASE}/{f['id']}",
        headers=auth(team["adv1"]),
        json=body(city_ids["mashhad"], rooms=9) | {"version": 1},
    )
    assert stale.status_code == 409 and stale.json()["error"]["code"] == "version_conflict"
    assert client.get(f"{BASE}/{f['id']}", headers=auth(team["adv1"])).json()["rooms"] == 3

    missing_version = client.put(
        f"{BASE}/{f['id']}", headers=auth(team["adv1"]), json=body(city_ids["mashhad"])
    )
    assert missing_version.status_code == 422


def test_status_endpoint(client, team, city_ids):
    f = create(client, team["adv1"], city_ids["mashhad"])
    closed = client.post(
        f"{BASE}/{f['id']}/status",
        headers=auth(team["adv1"]),
        json={"status": "closed", "deal_date": "2026-09-01"},
    )
    assert (
        closed.status_code == 200
        and closed.json()["status"] == "closed"
        and closed.json()["deal_date"] == "2026-09-01"
    )
    assert client.get(BASE, headers=auth(team["adv1"])).json()["total"] == 0
    assert client.get(BASE + "?status=closed", headers=auth(team["adv1"])).json()["total"] == 1
    assert (
        client.post(
            f"{BASE}/{f['id']}/status", headers=auth(team["adv1"]), json={"status": "sold"}
        ).status_code
        == 422
    )


def test_history_endpoint(client, team, city_ids):
    f = create(client, team["adv1"], city_ids["mashhad"])
    client.put(
        f"{BASE}/{f['id']}",
        headers=auth(team["adv1"]),
        json=body(city_ids["mashhad"], rooms=5) | {"version": 1},
    )
    history = client.get(f"{BASE}/{f['id']}/history", headers=auth(team["adv1"])).json()
    assert [h["action"] for h in history] == ["update", "create"]
    assert (
        history[0]["changes"]["rooms"] == {"from": 2, "to": 5}
        and history[0]["user"]["full_name"] == "Advisor One"
    )
    assert client.get(f"{BASE}/{f['id']}/history", headers=auth(team["adv2"])).status_code == 404


# ------------------------------------------------------------ lists, filters, favorites
def test_list_pagination_filters_and_sorting(client, team, city_ids):
    for i in range(5):
        create(
            client,
            team["adv1"],
            city_ids["mashhad"],
            price_total=(i + 1) * 1_000_000_000,
            address=f"addr {i}",
        )
    create(
        client,
        team["adv1"],
        city_ids["tehran"],
        deal_type="rent",
        deposit=500_000_000,
        monthly_rent=20_000_000,
    )

    page = client.get(
        BASE + "?page_size=4&sort_by=price&order=asc", headers=auth(team["adv1"])
    ).json()
    assert (
        page["total"] == 6
        and page["total_pages"] == 2
        and page["page"] == 1
        and len(page["items"]) == 4
    )
    assert [i["sort_price"] for i in page["items"]][:2] == [20_000_000, 1_000_000_000]
    second = client.get(BASE + "?page_size=4&page=2", headers=auth(team["adv1"])).json()
    assert len(second["items"]) == 2

    rent = client.get(
        BASE + "?deal_type=rent&min_deposit=400000000", headers=auth(team["adv1"])
    ).json()
    assert rent["total"] == 1 and rent["items"][0]["city"]["name"] == "تهران"
    cities = client.get(f"{BASE}?city_id={city_ids['tehran']}", headers=auth(team["adv1"])).json()
    assert cities["total"] == 1
    multi = client.get(BASE + "?deal_type=rent&deal_type=sale", headers=auth(team["adv1"])).json()
    assert multi["total"] == 6
    amenity = client.get(BASE + "?amenity=elevator", headers=auth(team["adv1"])).json()
    assert amenity["total"] == 0


def test_query_parameter_validation(client, team):
    h = auth(team["adv1"])
    assert client.get(BASE + "?page_size=500", headers=h).status_code == 422
    assert client.get(BASE + "?page=0", headers=h).status_code == 422
    assert client.get(BASE + "?order=sideways", headers=h).status_code == 422
    assert client.get(BASE + "?status=deleted", headers=h).status_code == 422
    bad_sort = client.get(BASE + "?sort_by=owner_phone", headers=h)
    assert bad_sort.status_code == 422 and bad_sort.json()["error"]["code"] == "invalid_input"


def test_search_over_http_with_persian_digits(client, team, city_ids):
    create(client, team["adv1"], city_ids["mashhad"], address="خیابان ۱۲ كوچه ي ۳")
    create(client, team["adv1"], city_ids["mashhad"], address="خیابان دیگر")
    found = client.get(BASE, params={"search": "۱۲ کوچه"}, headers=auth(team["adv1"])).json()
    assert found["total"] == 1


def test_favorites_over_http(client, team, city_ids):
    f = create(client, team["adv1"], city_ids["mashhad"])
    assert client.post(f"{BASE}/{f['id']}/favorite", headers=auth(team["adv1"])).json() == {
        "is_favorite": True
    }
    assert client.get(f"{BASE}/{f['id']}", headers=auth(team["adv1"])).json()["is_favorite"] is True
    only = client.get(BASE + "?favorites_only=true", headers=auth(team["adv1"])).json()
    assert only["total"] == 1 and only["items"][0]["is_favorite"] is True
    assert client.post(f"{BASE}/{f['id']}/favorite", headers=auth(team["adv2"])).status_code == 404
    assert client.post(f"{BASE}/{f['id']}/favorite", headers=auth(team["adv1"])).json() == {
        "is_favorite": False
    }
    assert (
        client.get(BASE + "?favorites_only=true", headers=auth(team["adv1"])).json()["total"] == 0
    )


def test_similar_and_stats_over_http(client, team, city_ids):
    mine = create(client, team["adv2"], city_ids["mashhad"], owner_phone="09125556677")
    create(client, team["adv1"], city_ids["mashhad"], owner_phone="09125556677")
    rows = client.get(
        "/api/v1/properties/similar",
        params={"owner_phone": "0912 555 6677"},
        headers=auth(team["adv2"]),
    ).json()
    by_name = {r["advisor_name"]: r for r in rows}
    assert by_name["Advisor Two"]["property_id"] == mine["id"]
    assert (
        by_name["Advisor One"]["property_id"] is None
        and by_name["Advisor One"]["owner_phone"] is None
    )

    stats = client.get("/api/v1/properties/stats", headers=auth(team["manager"])).json()
    assert stats["total_active"] == 2 and stats["by_deal_type"]["sale"] == 2
    assert (
        client.get("/api/v1/properties/stats", headers=auth(team["other"])).json()["total_active"]
        == 0
    )


def test_other_agency_cannot_touch_anything(client, team, city_ids):
    f = create(client, team["adv1"], city_ids["mashhad"])
    h = auth(team["other"])
    assert (
        client.put(
            f"{BASE}/{f['id']}", headers=h, json=body(city_ids["mashhad"]) | {"version": 1}
        ).status_code
        == 404
    )
    assert (
        client.post(f"{BASE}/{f['id']}/status", headers=h, json={"status": "closed"}).status_code
        == 404
    )
    assert (
        client.post(f"{BASE}/{f['id']}/share", headers=h, json={"shared": True}).status_code == 404
    )
    assert client.post(f"{BASE}/{f['id']}/soft-delete", headers=h).status_code == 404
    assert client.get(f"{BASE}/{f['id']}/history", headers=h).status_code == 404


# --------------------------------------------------------------------------- reference data
def test_vocab_is_public_and_complete(client):
    res = client.get("/api/v1/vocab")
    assert res.status_code == 200
    data = res.json()
    assert set(data) == {
        "deal_types",
        "statuses",
        "property_types",
        "amenities",
        "directions",
        "occupancy",
        "document_types",
    }
    assert {i["key"] for i in data["deal_types"]} == {"sale", "presale", "rent", "mortgage"}
    assert len(data["property_types"]) == 13
    assert all(i["fa"] and i["en"] for items in data.values() for i in items)
    assert any(i["fa"] == "سند تک‌برگ" for i in data["document_types"])


def test_geo_endpoints(client, team, city_ids):
    h = auth(team["adv1"])
    provinces = client.get("/api/v1/geo/provinces", headers=h).json()
    assert len(provinces) == 31
    khorasan = next(p for p in provinces if p["name"] == "خراسان رضوی")
    cities = client.get(
        "/api/v1/geo/cities", params={"province_id": khorasan["id"], "q": "مشه"}, headers=h
    ).json()
    assert cities[0]["name"] == "مشهد" and cities[0]["province_name"] == "خراسان رضوی"
    assert (
        client.get("/api/v1/geo/cities", params={"q": "نيشابور"}, headers=h).json()[0]["name"]
        == "نیشابور"
    )
    create(client, team["adv1"], city_ids["mashhad"], district="سجاد")
    districts = client.get(
        "/api/v1/geo/districts", params={"city_id": city_ids["mashhad"]}, headers=h
    ).json()
    assert districts == ["سجاد"]
    assert client.get("/api/v1/geo/provinces").status_code == 401


# ------------------------------------------------------------ temporary-password gate
def test_temporary_password_blocks_data_endpoints_but_not_account_endpoints(
    client, make_agency, city_ids, db
):
    info = make_agency("gate", must_change=True)
    token = login(client, info["phone"])
    h = auth(token)
    for method, path in (
        ("get", BASE),
        ("get", "/api/v1/users"),
        ("get", "/api/v1/geo/provinces"),
        ("get", f"{BASE}/stats"),
    ):
        res = getattr(client, method)(path, headers=h)
        assert (
            res.status_code == 403 and res.json()["error"]["code"] == "password_change_required"
        ), path
    assert client.post(BASE, headers=h, json=body(city_ids["mashhad"])).status_code == 403
    assert client.get("/api/v1/auth/me", headers=h).status_code == 200

    changed = client.post(
        "/api/v1/auth/change-password",
        headers=h,
        json={"current_password": info["password"], "new_password": "Brand-new-pass-1"},
    )
    assert changed.status_code == 204
    assert client.get(BASE, headers=h).status_code == 200


def test_advisor_created_by_a_manager_must_change_password_before_working(
    client, make_agency, city_ids, db
):
    info = make_agency("gate-advisor", seats=3)
    manager = login(client, info["phone"])
    phone = next_phone()
    created = client.post(
        "/api/v1/users",
        headers=auth(manager),
        json={"full_name": "New", "phone": phone, "role": "advisor", "password": "Temp-pass-123"},
    )
    assert created.status_code == 201
    token = login(client, phone, "Temp-pass-123")
    res = client.get(BASE, headers=auth(token))
    assert res.status_code == 403 and res.json()["error"]["code"] == "password_change_required"
    clear_must_change(db, created.json()["phone"])
    assert client.get(BASE, headers=auth(token)).status_code == 200

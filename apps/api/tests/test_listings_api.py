from tests.conftest import auth, login

BASE = "/api/v1/listings"


def test_add_from_link_then_list(client, make_agency, city_ids):
    agency = make_agency("listings-a")
    token = login(client, agency["phone"])

    res = client.post(
        BASE + "/from-link",
        headers=auth(token),
        json={"url": "https://divar.ir/v/some-ad", "title": "آپارتمان ۸۰ متری"},
    )
    assert res.status_code == 201, res.text
    assert res.json()["source"] == "divar"

    res = client.get(BASE, headers=auth(token))
    assert res.status_code == 200
    assert res.json()["total"] == 1


def test_other_agency_does_not_see_listing(client, make_agency, city_ids):
    a = make_agency("listings-b1")
    b = make_agency("listings-b2")
    tok_a = login(client, a["phone"])
    tok_b = login(client, b["phone"])

    client.post(BASE + "/from-link", headers=auth(tok_a), json={"url": "https://divar.ir/v/x"})

    res = client.get(BASE, headers=auth(tok_b))
    assert res.json()["total"] == 0

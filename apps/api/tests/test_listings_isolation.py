"""F7 S1: tenant isolation + happy paths for dismiss/convert on listing_inbox."""
import uuid

from sqlalchemy import text

from tests.conftest import auth, login

BASE = "/api/v1/listings"


def _add(client, token, url, **extra):
    res = client.post(BASE + "/from-link", headers=auth(token), json={"url": url, **extra})
    assert res.status_code == 201, res.text
    return res.json()


def _only_item(client, token):
    res = client.get(BASE, headers=auth(token))
    assert res.status_code == 200, res.text
    items = res.json()["items"]
    assert len(items) == 1
    return items[0]


# ------------------------------------------------------------ cross-agency isolation
def test_other_agency_cannot_dismiss(client, make_agency, city_ids):
    a = make_agency("iso-dismiss-a")
    b = make_agency("iso-dismiss-b")
    tok_a = login(client, a["phone"])
    tok_b = login(client, b["phone"])
    item = _add(client, tok_a, "https://divar.ir/v/iso-dismiss")

    res = client.post(f"{BASE}/{item['id']}/dismiss", headers=auth(tok_b))
    assert res.status_code == 404, res.text

    assert _only_item(client, tok_a)["status"] == "new"  # A's state untouched


def test_other_agency_cannot_convert(client, make_agency, city_ids):
    a = make_agency("iso-convert-a")
    b = make_agency("iso-convert-b")
    tok_a = login(client, a["phone"])
    tok_b = login(client, b["phone"])
    item = _add(client, tok_a, "https://divar.ir/v/iso-convert")

    res = client.post(
        f"{BASE}/{item['id']}/convert",
        headers=auth(tok_b),
        json={"deal_type": "sale", "city_id": city_ids["mashhad"]},
    )
    assert res.status_code == 404, res.text

    after = _only_item(client, tok_a)
    assert after["status"] == "new"
    assert after["converted_property_id"] is None


def test_unknown_listing_id_is_404(client, make_agency, city_ids):
    agency = make_agency("iso-unknown")
    token = login(client, agency["phone"])
    missing = uuid.uuid4()

    assert client.post(f"{BASE}/{missing}/dismiss", headers=auth(token)).status_code == 404
    res = client.post(
        f"{BASE}/{missing}/convert",
        headers=auth(token),
        json={"deal_type": "sale", "city_id": city_ids["mashhad"]},
    )
    assert res.status_code == 404, res.text


def test_malformed_listing_id_is_client_error_not_500(client, make_agency):
    agency = make_agency("iso-malformed")
    token = login(client, agency["phone"])
    res = client.post(f"{BASE}/not-a-uuid/dismiss", headers=auth(token))
    assert res.status_code in (404, 422), res.text


# ------------------------------------------------------------ happy paths
def test_dismiss_changes_status_and_filter(client, make_agency, city_ids):
    agency = make_agency("happy-dismiss")
    token = login(client, agency["phone"])
    item = _add(client, token, "https://divar.ir/v/happy-dismiss")

    res = client.post(f"{BASE}/{item['id']}/dismiss", headers=auth(token))
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "dismissed"

    dismissed = client.get(BASE, headers=auth(token), params={"status": "dismissed"}).json()
    new = client.get(BASE, headers=auth(token), params={"status": "new"}).json()
    assert dismissed["total"] == 1
    assert new["total"] == 0


def test_convert_creates_property_with_source(client, make_agency, make_advisor, city_ids, db):
    agency = make_agency("happy-convert")
    advisor = make_advisor(agency)
    token = login(client, advisor["phone"])
    item = _add(
        client,
        token,
        "https://divar.ir/v/happy-convert",
        title="آپارتمان ۸۰ متری",
        address="مشهد، وکیل‌آباد",
        city_id=city_ids["mashhad"],
        deal_type="sale",
        property_types=["apartment"],
        price_total=3_000_000_000,
    )

    res = client.post(
        f"{BASE}/{item['id']}/convert",
        headers=auth(token),
        json={"deal_type": "sale", "city_id": city_ids["mashhad"]},
    )
    assert res.status_code == 201, res.text
    property_id = res.json()["id"]

    after = _only_item(client, token)
    assert after["status"] == "converted"
    assert after["converted_property_id"] == property_id

    with db.connect() as conn:
        row = conn.execute(
            text("SELECT source, source_url FROM properties WHERE id = :i"), {"i": property_id}
        ).one()
    assert row.source == "divar"
    assert row.source_url == "https://divar.ir/v/happy-convert"

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.core.errors import (
    CityNotFound,
    Forbidden,
    InvalidInput,
    PropertyNotFound,
    UserNotFound,
    VersionConflict,
)
from app.db.models import Plan, Property, PropertyFavorite, PropertyHistory, Role
from app.db.session import tenant_session
from app.db.tenancy import TenantViolation
from app.services import properties as svc
from tests.conftest import make_ctx, prop_values


@pytest.fixture
def world(db, make_agency, make_advisor, city_ids):
    """One agency: a manager and two advisors; plus a second, unrelated agency."""
    agency = make_agency("files-a", plan=Plan.LARGE, seats=8)
    adv1 = make_advisor(agency, name="Advisor One")
    adv2 = make_advisor(agency, name="Advisor Two")
    other = make_agency("files-b", seats=3)
    aid = agency["agency_id"]
    return {
        "aid": aid,
        "city": city_ids,
        "manager": make_ctx(aid, agency["manager_id"], Role.MANAGER),
        "adv1": make_ctx(aid, adv1["user_id"], Role.ADVISOR),
        "adv2": make_ctx(aid, adv2["user_id"], Role.ADVISOR),
        "other_manager": make_ctx(other["agency_id"], other["manager_id"], Role.MANAGER),
        "other_aid": other["agency_id"],
        "adv2_id": adv2["user_id"],
    }


def _sess(db, w, ctx=None):
    aid = ctx.agency_id if ctx else w["aid"]
    return tenant_session(aid, engine=db)


def _create(db, w, ctx, **kw):
    with _sess(db, w, ctx) as s:
        prop = svc.create_property(s, ctx, prop_values(w["city"]["mashhad"], **kw))
        s.commit()
        return prop.id


# ---------------------------------------------------------------- create and rules
def test_create_fills_per_m2_from_total_and_main_area(db, world):
    with _sess(db, world) as s:
        p = svc.create_property(s, world["adv1"], prop_values(world["city"]["mashhad"]))
        s.commit()
        assert p.price_total == 5_000_000_000 and p.price_per_m2 == 50_000_000
        assert float(p.main_area_m2) == 100.0 and p.sort_price == 5_000_000_000
        assert p.owner_user_id == world["adv1"].user_id and p.version == 1 and p.status == "active"


def test_create_fills_total_from_per_m2_and_built_area_wins_over_land(db, world):
    with _sess(db, world) as s:
        land_only = svc.create_property(
            s,
            world["adv1"],
            prop_values(
                world["city"]["mashhad"],
                built_area_m2=None,
                land_area_m2=200,
                price_total=None,
                price_per_m2=25_000_000,
            ),
        )
        both = svc.create_property(
            s,
            world["adv1"],
            prop_values(
                world["city"]["mashhad"],
                built_area_m2=100,
                land_area_m2=200,
                price_total=None,
                price_per_m2=40_000_000,
            ),
        )
        assert land_only.price_total == 5_000_000_000
        assert float(both.main_area_m2) == 100.0 and both.price_total == 4_000_000_000


def test_deal_rules_drop_fields_that_do_not_apply(db, world):
    c = world["city"]["mashhad"]
    with _sess(db, world) as s:
        rent = svc.create_property(
            s,
            world["adv1"],
            prop_values(
                c,
                deal_type="rent",
                price_total=9,
                price_per_m2=9,
                deposit=700_000_000,
                monthly_rent=30_000_000,
                contract_end_date=date(2027, 1, 1),
                delivery_date=date(2027, 2, 1),
                payment_terms="x",
                convertible_options=[{"deposit": 800_000_000, "monthly_rent": 20_000_000}],
            ),
        )
        assert rent.price_total is None and rent.price_per_m2 is None and rent.delivery_date is None
        assert rent.payment_terms is None and rent.sort_price == 30_000_000
        assert rent.convertible_options == [{"deposit": 800_000_000, "monthly_rent": 20_000_000}]

        mortgage = svc.create_property(
            s,
            world["adv1"],
            prop_values(
                c,
                deal_type="mortgage",
                deposit=2_000_000_000,
                monthly_rent=5,
                convertible_options=[{"deposit": 1_500_000_000, "monthly_rent": 40_000_000}],
            ),
        )
        assert mortgage.monthly_rent is None and mortgage.sort_price == 2_000_000_000
        assert len(mortgage.convertible_options) == 1

        sale = svc.create_property(
            s,
            world["adv1"],
            prop_values(
                c,
                deposit=1,
                monthly_rent=1,
                contract_end_date=date(2027, 1, 1),
                delivery_date=date(2027, 1, 1),
                convertible_options=[{"deposit": 1, "monthly_rent": 1}],
            ),
        )
        assert (
            sale.deposit is None and sale.contract_end_date is None and sale.delivery_date is None
        )
        assert sale.convertible_options == []

        presale = svc.create_property(
            s,
            world["adv1"],
            prop_values(
                c, deal_type="presale", delivery_date=date(2027, 6, 1), payment_terms="۴۰٪ نقد"
            ),
        )
        assert presale.delivery_date == date(2027, 6, 1) and presale.payment_terms == "۴۰٪ نقد"


def test_urgent_until_is_dropped_when_not_urgent(db, world):
    with _sess(db, world) as s:
        p = svc.create_property(
            s,
            world["adv1"],
            prop_values(world["city"]["mashhad"], is_urgent=False, urgent_until=date(2027, 1, 1)),
        )
        assert p.urgent_until is None


def test_owner_phone_is_normalised_and_landlines_are_allowed(db, world):
    c = world["city"]["mashhad"]
    with _sess(db, world) as s:
        mobile = svc.create_property(s, world["adv1"], prop_values(c, owner_phone="۰۹۱۲ ۱۱۱ ۲۲۳۳"))
        landline = svc.create_property(s, world["adv1"], prop_values(c, owner_phone="051-38123456"))
        none = svc.create_property(s, world["adv1"], prop_values(c, owner_phone="  "))
        assert mobile.owner_phone == "+989121112233"
        assert landline.owner_phone == "+985138123456" and none.owner_phone is None
        with pytest.raises(InvalidInput):
            svc.create_property(s, world["adv1"], prop_values(c, owner_phone="12345"))


def test_unknown_city_rejected(db, world):
    with _sess(db, world) as s, pytest.raises(CityNotFound):
        svc.create_property(s, world["adv1"], prop_values(99999999))


def test_search_text_is_normalised(db, world):
    with _sess(db, world) as s:
        p = svc.create_property(
            s,
            world["adv1"],
            prop_values(
                world["city"]["mashhad"],
                address="خیابان ۱۲ كوچه",
                notes="كولر گازي",
                custom_amenities=["سونا\u200cخشک"],
            ),
        )
        assert "خیابان 12 کوچه" in p.search_text and "مشهد" in p.search_text
        assert "کولر گازی" in p.search_text and "سونا خشک" in p.search_text
        assert "09121112233" in p.search_text and "+989121112233" in p.search_text


def test_manager_can_create_for_an_advisor_but_advisor_cannot(db, world):
    with _sess(db, world) as s:
        v = prop_values(world["city"]["mashhad"])
        p = svc.create_property(s, world["manager"], v, owner_user_id=world["adv1"].user_id)
        assert p.owner_user_id == world["adv1"].user_id
        with pytest.raises(Forbidden):
            svc.create_property(s, world["adv1"], v, owner_user_id=world["adv2"].user_id)
        with pytest.raises(UserNotFound):
            svc.create_property(s, world["manager"], v, owner_user_id=uuid.uuid4())


# ---------------------------------------------------------------- visibility and permissions
def test_visibility_rules(db, world):
    own1 = _create(db, world, world["adv1"], address="own-1")
    own2 = _create(db, world, world["adv2"], address="own-2")

    def visible(ctx):
        with _sess(db, world, ctx) as s:
            return {p.id for p in svc.list_properties(s, ctx, svc.PropertyFilters())[0]}

    assert visible(world["adv1"]) == {own1}
    assert visible(world["adv2"]) == {own2}
    assert visible(world["manager"]) == {own1, own2}
    assert visible(world["other_manager"]) == set()


def test_invisible_foreign_and_missing_files_look_identical(db, world):
    pid = _create(db, world, world["adv1"])
    for ctx in (world["adv2"], world["other_manager"]):
        with _sess(db, world, ctx) as s, pytest.raises(PropertyNotFound):
            svc.get_property(s, ctx, pid)
    with _sess(db, world) as s, pytest.raises(PropertyNotFound):
        svc.get_property(s, world["adv1"], uuid.uuid4())


def test_sharing_gives_read_only_access_to_other_advisors(db, world):
    pid = _create(db, world, world["adv1"])
    with _sess(db, world) as s:
        svc.set_shared(s, world["manager"], pid, True)
        s.commit()
    with _sess(db, world) as s:
        assert svc.get_property(s, world["adv2"], pid).id == pid
        assert svc.can_edit(world["adv2"], svc.get_property(s, world["adv2"], pid)) is False
        with pytest.raises(Forbidden):
            svc.update_property(
                s, world["adv2"], pid, prop_values(world["city"]["mashhad"]), expected_version=1
            )
        with pytest.raises(Forbidden):
            svc.set_status(s, world["adv2"], pid, "inactive")
        assert svc.toggle_favorite(s, world["adv2"], pid) is True  # may star what they can see


def test_share_reassign_delete_are_manager_only(db, world):
    pid = _create(db, world, world["adv1"])
    with _sess(db, world) as s:
        for call in (
            lambda: svc.set_shared(s, world["adv1"], pid, True),
            lambda: svc.reassign(s, world["adv1"], pid, world["adv2"].user_id),
            lambda: svc.soft_delete(s, world["adv1"], pid),
        ):
            with pytest.raises(Forbidden):
                call()


def test_reassign_moves_ownership_and_rejects_foreign_or_unknown_users(db, world, make_agency):
    pid = _create(db, world, world["adv1"])
    other = make_agency("files-c", seats=2)
    with _sess(db, world) as s:
        moved = svc.reassign(s, world["manager"], pid, world["adv2"].user_id)
        assert moved.owner_user_id == world["adv2"].user_id
        with pytest.raises(UserNotFound):
            svc.reassign(s, world["manager"], pid, other["manager_id"])  # another agency's user
        with pytest.raises(UserNotFound):
            svc.reassign(s, world["manager"], pid, uuid.uuid4())


# ---------------------------------------------------------------- optimistic locking and history
def test_update_bumps_version_and_records_a_diff(db, world):
    pid = _create(db, world, world["adv1"])
    with _sess(db, world) as s:
        p = svc.update_property(
            s,
            world["adv1"],
            pid,
            prop_values(world["city"]["mashhad"], price_total=5_500_000_000, rooms=3),
            expected_version=1,
        )
        s.commit()
        assert p.version == 2 and p.price_total == 5_500_000_000 and p.price_per_m2 == 55_000_000
    with _sess(db, world) as s:
        history = svc.list_history(s, world["adv1"], pid)
        assert [h.action for h, _ in history] == ["update", "create"]
        changes = history[0][0].changes
        assert changes["price_total"] == {"from": 5_000_000_000, "to": 5_500_000_000}
        assert changes["rooms"] == {"from": 2, "to": 3}
        assert history[0][1].full_name == "Advisor One"


def test_stale_version_is_rejected(db, world):
    pid = _create(db, world, world["adv1"])
    with _sess(db, world) as s, pytest.raises(VersionConflict):
        svc.update_property(
            s,
            world["adv1"],
            pid,
            prop_values(world["city"]["mashhad"], rooms=9),
            expected_version=7,
        )


def test_concurrent_edits_cannot_overwrite_each_other(db, world):
    pid = _create(db, world, world["adv1"])
    c = world["city"]["mashhad"]
    first = tenant_session(world["aid"], engine=db)
    second = tenant_session(world["aid"], engine=db)
    try:
        # both read version 1
        svc.get_property(first, world["adv1"], pid)
        svc.get_property(second, world["adv1"], pid)
        svc.update_property(second, world["adv1"], pid, prop_values(c, rooms=4), expected_version=1)
        second.commit()
        with pytest.raises(VersionConflict):  # the first session still believes it is version 1
            svc.update_property(
                first, world["adv1"], pid, prop_values(c, rooms=5), expected_version=1
            )
    finally:
        first.close()
        second.close()
    with _sess(db, world) as s:
        assert svc.get_property(s, world["adv1"], pid).rooms == 4


def test_update_without_changes_does_not_bump_version_or_write_history(db, world):
    pid = _create(db, world, world["adv1"])
    with _sess(db, world) as s:
        p = svc.update_property(
            s, world["adv1"], pid, prop_values(world["city"]["mashhad"]), expected_version=1
        )
        s.commit()
        assert p.version == 1
        assert len(svc.list_history(s, world["adv1"], pid)) == 1


# ---------------------------------------------------------------- status, delete, favorites
def test_status_flow(db, world):
    pid = _create(db, world, world["adv1"])
    with _sess(db, world) as s:
        closed = svc.set_status(s, world["adv1"], pid, "closed")
        assert closed.status == "closed" and closed.deal_date == datetime.now(UTC).date()
        dated = svc.set_status(s, world["adv1"], pid, "active")
        assert dated.status == "active" and dated.deal_date is None
        back = svc.set_status(s, world["adv1"], pid, "closed", date(2026, 5, 1))
        assert back.deal_date == date(2026, 5, 1)
        with pytest.raises(InvalidInput):
            svc.set_status(s, world["adv1"], pid, "sold")
        assert [h.action for h, _ in svc.list_history(s, world["adv1"], pid)][:3] == [
            "status",
            "status",
            "status",
        ]


def test_closed_and_inactive_files_are_filtered_by_status(db, world):
    a, b, c = (_create(db, world, world["adv1"], address=f"f{i}") for i in range(3))
    with _sess(db, world) as s:
        svc.set_status(s, world["adv1"], b, "inactive")
        svc.set_status(s, world["adv1"], c, "closed")
        s.commit()

    def ids(status):
        with _sess(db, world) as s:
            return {
                p.id
                for p in svc.list_properties(s, world["adv1"], svc.PropertyFilters(status=status))[
                    0
                ]
            }

    assert ids("active") == {a} and ids("inactive") == {b} and ids("closed") == {c}
    assert ids("any") == {a, b, c}


def test_soft_deleted_file_is_gone_for_everyone_and_cannot_be_revived(db, world):
    pid = _create(db, world, world["adv1"])
    with _sess(db, world) as s:
        svc.soft_delete(s, world["manager"], pid)
        s.commit()
    for ctx in (world["manager"], world["adv1"]):
        with _sess(db, world, ctx) as s:
            with pytest.raises(PropertyNotFound):
                svc.get_property(s, ctx, pid)
            with pytest.raises(PropertyNotFound):  # the legacy "reactivate a deleted file" bug
                svc.set_status(s, ctx, pid, "active")
            assert svc.list_properties(s, ctx, svc.PropertyFilters(status="any"))[1] == 0
    with _sess(db, world) as s:  # the row still exists for support
        row = s.scalar(select(Property).where(Property.id == pid))
        assert row.deleted_at is not None and row.deleted_by_user_id == world["manager"].user_id


def test_favorites_are_personal(db, world):
    pid = _create(db, world, world["adv1"])
    with _sess(db, world) as s:
        svc.set_shared(s, world["manager"], pid, True)
        assert svc.toggle_favorite(s, world["adv1"], pid) is True
        assert svc.toggle_favorite(s, world["adv2"], pid) is True
        assert svc.toggle_favorite(s, world["adv1"], pid) is False
        s.commit()
        assert svc.favorite_ids(s, world["adv1"], [pid]) == set()
        assert svc.favorite_ids(s, world["adv2"], [pid]) == {pid}
        only = svc.PropertyFilters(favorites_only=True)
        assert [p.id for p in svc.list_properties(s, world["adv2"], only)[0]] == [pid]
        assert svc.list_properties(s, world["adv1"], only)[1] == 0


def test_cannot_favorite_a_file_you_cannot_see(db, world):
    pid = _create(db, world, world["adv1"])
    with _sess(db, world) as s, pytest.raises(PropertyNotFound):
        svc.toggle_favorite(s, world["adv2"], pid)
    with _sess(db, world) as s:
        assert s.scalars(select(PropertyFavorite)).all() == []


def test_history_tracks_every_kind_of_change(db, world):
    pid = _create(db, world, world["adv1"])
    with _sess(db, world) as s:
        svc.set_shared(s, world["manager"], pid, True)
        svc.reassign(s, world["manager"], pid, world["adv2"].user_id)
        svc.soft_delete(s, world["manager"], pid)
        s.commit()
        actions = [
            h.action
            for h in s.scalars(select(PropertyHistory).order_by(PropertyHistory.created_at))
        ]
        assert sorted(actions) == sorted(["create", "share", "reassign", "delete"])


# ------------------------------------------------------- tenant isolation of the new tables
def test_other_agencies_never_see_or_touch_files(db, world):
    pid = _create(db, world, world["adv1"])
    with tenant_session(world["other_aid"], engine=db) as s:
        assert s.scalars(select(Property)).all() == []
        assert s.get(Property, pid) is None
        assert s.scalars(select(PropertyHistory)).all() == []
        s.add(
            Property(
                agency_id=world["aid"],
                owner_user_id=world["adv1"].user_id,
                deal_type="sale",
                city_id=world["city"]["mashhad"],
            )
        )
        with pytest.raises(TenantViolation):
            s.flush()


# ---------------------------------------------------------------- database-level guarantees
@pytest.mark.parametrize(
    "assignment",
    [
        "deal_type = 'barter'",
        "status = 'sold'",
        "amenities = ARRAY['helipad']::varchar[]",
        "property_types = ARRAY['castle']::varchar[]",
        "ownership_dang = 7",
        "price_total = -1",
        "build_year = 900",
        "direction = 'up'",
    ],
)
def test_database_rejects_invalid_values_even_without_the_api(db, world, assignment):
    pid = _create(db, world, world["adv1"])
    with pytest.raises(IntegrityError), db.begin() as conn:
        conn.execute(text(f"UPDATE properties SET {assignment} WHERE id = :id"), {"id": pid})


def test_prices_above_two_billion_toman_are_stored_exactly(db, world):
    with _sess(db, world) as s:
        p = svc.create_property(
            s, world["adv1"], prop_values(world["city"]["mashhad"], price_total=25_000_000_000)
        )
        s.commit()
        assert p.price_total == 25_000_000_000 and p.price_per_m2 == 250_000_000


# ---------------------------------------------------------------- filters, sorting, pagination
@pytest.fixture
def catalog(db, world):
    """Eight files owned by advisor one, for filter tests. Returns {name: id}."""
    m, t = world["city"]["mashhad"], world["city"]["tehran"]
    today = datetime.now(UTC).date()
    specs = {
        "flat": dict(
            property_types=["apartment"],
            district="وکیل‌آباد",
            built_area_m2=100,
            rooms=2,
            floor=3,
            total_floors=5,
            build_year=1395,
            direction="south",
            amenities=["elevator", "parking"],
            document_type="tak_barg",
            occupancy="vacant",
            price_total=5_000_000_000,
            address="بلوار وکیل آباد",
            owner_phone="09121112233",
            owner_name="احمدی",
        ),
        "villa": dict(
            property_types=["villa"],
            district="سجاد",
            land_area_m2=400,
            built_area_m2=250,
            rooms=4,
            build_year=1385,
            direction="north",
            is_corner=True,
            amenities=["pool", "yard"],
            document_type="mangoole_dar",
            occupancy="owner_occupied",
            price_total=20_000_000_000,
            address="بلوار سجاد",
            is_urgent=True,
        ),
        "land": dict(
            property_types=["land"],
            built_area_m2=None,
            land_area_m2=300,
            rooms=None,
            price_total=None,
            price_per_m2=30_000_000,
            document_type="qolnameh",
            address="جاده قوچان",
        ),
        "rent_a": dict(
            deal_type="rent",
            deposit=700_000_000,
            monthly_rent=30_000_000,
            built_area_m2=80,
            rooms=1,
            amenities=["elevator"],
            contract_end_date=today + timedelta(days=5),
            occupancy="tenant_occupied",
            vacate_date=today + timedelta(days=60),
            address="احمدآباد",
        ),
        "rent_b": dict(
            deal_type="rent",
            deposit=300_000_000,
            monthly_rent=10_000_000,
            built_area_m2=60,
            rooms=1,
            contract_end_date=today + timedelta(days=25),
            address="قاسم‌آباد",
        ),
        "mortgage": dict(
            deal_type="mortgage",
            deposit=1_500_000_000,
            built_area_m2=90,
            rooms=2,
            contract_end_date=today - timedelta(days=3),
            address="ملک‌آباد",
            convertible_options=[{"deposit": 1_000_000_000, "monthly_rent": 25_000_000}],
        ),
        "presale": dict(
            deal_type="presale",
            rooms=None,
            price_total=3_000_000_000,
            built_area_m2=110,
            delivery_date=today + timedelta(days=400),
            address="طلاب",
        ),
        "tehran": dict(
            city_id=t, rooms=None, price_total=9_000_000_000, built_area_m2=150, address="ولنجک"
        ),
    }
    ids = {}
    with _sess(db, world) as s:
        for name, extra in specs.items():
            extra = dict(extra)
            city = extra.pop("city_id", m)
            ids[name] = svc.create_property(s, world["adv1"], prop_values(city, **extra)).id
        s.commit()
    return ids


def _find(db, world, ctx=None, **filters):
    ctx = ctx or world["adv1"]
    with _sess(db, world, ctx) as s:
        return {
            p.id
            for p in svc.list_properties(s, ctx, svc.PropertyFilters(**filters), page_size=200)[0]
        }


@pytest.mark.parametrize(
    ("filters", "expected"),
    [
        ({"deal_types": ["rent"]}, {"rent_a", "rent_b"}),
        ({"deal_types": ["rent", "mortgage"]}, {"rent_a", "rent_b", "mortgage"}),
        ({"property_types": ["villa", "land"]}, {"villa", "land"}),
        ({"district": "وکیل آباد"}, {"flat"}),  # a space matches the half-space (ZWNJ)
        ({"district": "وکیل"}, {"flat"}),
        ({"min_area": 100, "max_area": 150}, {"flat", "presale", "tehran"}),
        ({"min_area": 250}, {"villa", "land"}),  # built area wins over land; land-only uses land
        ({"min_rooms": 2, "max_rooms": 2}, {"flat", "mortgage"}),
        ({"min_floor": 3}, {"flat"}),
        ({"min_build_year": 1390}, {"flat"}),
        ({"max_build_year": 1390}, {"villa"}),
        ({"directions": ["north"]}, {"villa"}),
        ({"is_corner": True}, {"villa"}),
        ({"document_types": ["tak_barg", "qolnameh"]}, {"flat", "land"}),
        ({"occupancy": ["vacant", "tenant_occupied"]}, {"flat", "rent_a"}),
        ({"amenities_all": ["elevator", "parking"]}, {"flat"}),
        ({"amenities_all": ["elevator"]}, {"flat", "rent_a"}),
        (
            {"amenities_none": ["elevator"]},
            {"villa", "land", "rent_b", "mortgage", "presale", "tehran"},
        ),
        (
            {"min_price": 6_000_000_000},
            {"villa", "tehran", "land"},
        ),  # land: 30M x 300 m2 = 9 billion
        ({"max_price": 10_000_000}, {"rent_b"}),  # for rent, "price" means monthly rent
        ({"min_price_per_m2": 29_000_000}, {"flat", "villa", "land", "tehran"}),
        ({"min_deposit": 1_000_000_000}, {"mortgage"}),
        ({"max_rent": 10_000_000}, {"rent_b"}),
        ({"contract_ends_within_days": 7}, {"rent_a", "mortgage"}),
        ({"contract_ends_within_days": 30}, {"rent_a", "rent_b", "mortgage"}),
        (
            {"urgent_only": True},
            {"villa", "rent_a"},
        ),  # flagged file, and a contract ending in 5 days
    ],
)
def test_filters(db, world, catalog, filters, expected):
    assert _find(db, world, **filters) == {catalog[n] for n in expected}


def test_province_and_city_filters(db, world, catalog):
    with db.connect() as conn:
        khorasan = conn.execute(
            text(
                "SELECT p.id FROM provinces p JOIN cities c ON c.province_id = p.id "
                "WHERE c.name = 'مشهد'"
            )
        ).scalar_one()
    assert _find(db, world, city_id=world["city"]["tehran"]) == {catalog["tehran"]}
    assert catalog["tehran"] not in _find(db, world, province_id=khorasan)
    assert catalog["flat"] in _find(db, world, province_id=khorasan)


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("وکیل", {"flat"}),
        ("وکیل آباد", {"flat"}),  # every word must match, in any order
        ("آباد وکیل", {"flat"}),
        (
            "۰۹۱۲۱۱۱۲۲۳۳",
            {"flat", "villa", "land", "rent_a", "rent_b", "mortgage", "presale", "tehran"},
        ),
        ("سجاد", {"villa"}),
        ("ولنجک", {"tehran"}),
        ("تهران", {"tehran"}),
        ("هیچی", set()),
    ],
)
def test_search(db, world, catalog, query, expected):
    assert _find(db, world, search=query) == {catalog[n] for n in expected}


def test_search_by_international_phone_form(db, world, catalog):
    assert catalog["flat"] in _find(db, world, search="+989121112233")


def test_search_treats_arabic_letters_digits_and_special_characters_safely(db, world, catalog):
    assert catalog["flat"] in _find(db, world, search="وكيل")  # Arabic kaf
    assert _find(db, world, search="100%") == set()  # % is not a wildcard
    assert _find(db, world, search="_") == set()
    assert _find(db, world, search="'; DROP TABLE properties; --") == set()


def test_owner_filter_works_for_managers_only(db, world, catalog):
    assert _find(db, world, ctx=world["manager"], owner_user_id=world["adv2"].user_id) == set()
    assert len(_find(db, world, ctx=world["manager"], owner_user_id=world["adv1"].user_id)) == 8
    # an advisor cannot widen their view by naming another owner
    assert _find(db, world, ctx=world["adv2"], owner_user_id=world["adv1"].user_id) == set()


def test_sorting_and_pagination(db, world, catalog):
    with _sess(db, world) as s:
        items, total, page, size = svc.list_properties(
            s, world["adv1"], svc.PropertyFilters(), sort_by="price", descending=False, page_size=3
        )
        assert total == 8 and size == 3 and page == 1
        assert [p.sort_price for p in items] == [10_000_000, 30_000_000, 1_500_000_000]
        nulls_last, _, _, _ = svc.list_properties(
            s, world["adv1"], svc.PropertyFilters(), sort_by="price", descending=True, page_size=200
        )
        assert nulls_last[0].sort_price == 20_000_000_000
        by_area, *_ = svc.list_properties(
            s, world["adv1"], svc.PropertyFilters(), sort_by="area", descending=False, page_size=200
        )
        assert float(by_area[0].main_area_m2) == 60.0
        page2, total2, p2, _ = svc.list_properties(
            s, world["adv1"], svc.PropertyFilters(), sort_by="created_at", page=3, page_size=3
        )
        assert len(page2) == 2 and total2 == 8 and p2 == 3
        capped = svc.list_properties(s, world["adv1"], svc.PropertyFilters(), page_size=10_000)
        assert capped[3] == svc.MAX_PAGE_SIZE
        with pytest.raises(InvalidInput):
            svc.list_properties(s, world["adv1"], svc.PropertyFilters(), sort_by="owner_phone")


def test_sort_by_contract_end_date_puts_files_without_one_last(db, world, catalog):
    with _sess(db, world) as s:
        items, *_ = svc.list_properties(
            s, world["adv1"], svc.PropertyFilters(), sort_by="contract_end_date", descending=False
        )
        dates = [p.contract_end_date for p in items]
        assert dates[:3] == sorted(d for d in dates if d)[:3] and dates[-1] is None


def test_urgent_logic_expires(db, world):
    today = datetime.now(UTC).date()
    c = world["city"]["mashhad"]
    with _sess(db, world) as s:
        expired = svc.create_property(
            s, world["adv1"], prop_values(c, is_urgent=True, urgent_until=today - timedelta(days=1))
        )
        open_ended = svc.create_property(s, world["adv1"], prop_values(c, is_urgent=True))
        future = svc.create_property(
            s, world["adv1"], prop_values(c, is_urgent=True, urgent_until=today + timedelta(days=3))
        )
        s.commit()
        assert (
            not svc.is_urgent_now(expired)
            and svc.is_urgent_now(open_ended)
            and svc.is_urgent_now(future)
        )
        found = {
            p.id
            for p in svc.list_properties(s, world["adv1"], svc.PropertyFilters(urgent_only=True))[0]
        }
        assert found == {open_ended.id, future.id}


# ---------------------------------------------------------------- similar files and statistics
def test_similar_files_hide_details_the_caller_may_not_see(db, world):
    c = world["city"]["mashhad"]
    mine = _create(db, world, world["adv2"], owner_phone="09123334455", address="خیابان الف")
    theirs = _create(db, world, world["adv1"], owner_phone="09123334455", address="خیابان ب")
    with _sess(db, world) as s:
        for_adv2 = svc.find_similar(s, world["adv2"], owner_phone="0912 333 4455")
        by_id = {r["advisor_name"]: r for r in for_adv2}
        assert by_id["Advisor Two"]["property_id"] == mine and by_id["Advisor Two"]["owner_phone"]
        hidden = by_id["Advisor One"]
        assert (
            hidden["property_id"] is None
            and hidden["owner_phone"] is None
            and hidden["owner_name"] is None
        )
        assert hidden["kind"] == "phone" and hidden["city_name"] == "مشهد"
        seen_by_manager = svc.find_similar(s, world["manager"], owner_phone="09123334455")
        assert {r["property_id"] for r in seen_by_manager} == {mine, theirs}
        assert (
            svc.find_similar(s, world["adv2"], owner_phone="09123334455", exclude_id=mine)[0][
                "advisor_name"
            ]
            == "Advisor One"
        )
        by_address = svc.find_similar(s, world["manager"], city_id=c, address="  خیابان الف ")
        assert [r["property_id"] for r in by_address] == [mine] and by_address[0][
            "kind"
        ] == "address"
        assert (
            svc.find_similar(
                s, world["manager"], city_id=world["city"]["tehran"], address="خیابان الف"
            )
            == []
        )
        assert svc.find_similar(s, world["manager"]) == []


def test_similar_ignores_deleted_and_inactive_files(db, world):
    pid = _create(db, world, world["adv1"], owner_phone="09124445566")
    with _sess(db, world) as s:
        svc.set_status(s, world["adv1"], pid, "inactive")
        s.commit()
        assert svc.find_similar(s, world["manager"], owner_phone="09124445566") == []


def test_stats(db, world, catalog):
    with _sess(db, world) as s:
        st = svc.stats(s, world["adv1"])
        assert st["total_active"] == 8 and st["new_this_week"] == 8
        assert st["by_deal_type"] == {"sale": 4, "presale": 1, "rent": 2, "mortgage": 1}
        assert st["urgent"] == 2 and st["contracts_overdue"] == 1
        assert st["contracts_ending_7_days"] == 1 and st["contracts_ending_30_days"] == 2
        assert svc.stats(s, world["adv2"])["total_active"] == 0
        assert svc.stats(s, world["manager"])["total_active"] == 8


# ---------------------------------------------------------------- geography
def test_geography_is_seeded_and_searchable(db, world):
    with _sess(db, world) as s:
        cities = svc.search_cities(s, province_id=None, query="مشه")
        assert [c.name for c, _ in cities][0] == "مشهد"  # prefix match also finds مشهد ثامن, ...
        assert cities[0][1].name == "خراسان رضوی"
        assert [c.name for c, _ in svc.search_cities(s, province_id=None, query="نيشابور")] == [
            "نیشابور"
        ]
        total = s.execute(text("SELECT count(*) FROM cities")).scalar_one()
        assert total > 1300 and s.execute(text("SELECT count(*) FROM provinces")).scalar_one() == 31


def test_district_suggestions_come_from_the_agency_itself(db, world, make_agency):
    c = world["city"]["mashhad"]
    _create(db, world, world["adv1"], district="وکیل‌آباد")
    _create(db, world, world["adv1"], district="وکیل‌آباد")
    _create(db, world, world["adv1"], district="سجاد")
    with _sess(db, world) as s:
        assert svc.suggest_districts(s, city_id=c, query=None)[0] == "وکیل‌آباد"
        assert svc.suggest_districts(s, city_id=c, query="سج") == ["سجاد"]
    with tenant_session(world["other_aid"], engine=db) as s:
        assert svc.suggest_districts(s, city_id=c, query=None) == []

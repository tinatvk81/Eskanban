import uuid

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.core.errors import (
    EmailTaken,
    InvalidInput,
    LastManager,
    PhoneTaken,
    ScopeRequired,
    SeatLimitReached,
    SlugTaken,
    UserNotFound,
    WeakPassword,
)
from app.db.models import Agency, Plan, Role, User
from app.db.session import tenant_session
from app.services.agencies import add_user, create_agency, deactivate_user, list_users
from tests.conftest import PASSWORD, next_phone


def _create(session, **overrides):
    args = {
        "name": "Sunrise Realty",
        "slug": "sunrise",
        "plan": Plan.SMALL,
        "seat_limit": 3,
        "manager_phone": next_phone(),
        "manager_name": "Boss",
        "manager_password": PASSWORD,
    }
    args.update(overrides)
    return create_agency(session, **args)


def _advisor(session, **overrides):
    args = {
        "phone": next_phone(),
        "full_name": "Advisor",
        "role": Role.ADVISOR,
        "password": PASSWORD,
    }
    args.update(overrides)
    return add_user(session, **args)


def test_create_agency_creates_first_manager(system):
    agency, manager = _create(system)
    system.commit()
    assert agency.slug == "sunrise"
    assert manager.role is Role.MANAGER
    assert manager.agency_id == agency.id
    assert manager.is_active
    assert manager.must_change_password
    assert manager.password_hash and manager.password_hash != PASSWORD


@pytest.mark.parametrize("slug", ["ab", "-abc", "abc-", "has space", "UPPER", "a--b", "x" * 41])
def test_bad_slug_rejected(system, slug):
    with pytest.raises(InvalidInput):
        _create(system, slug=slug)


def test_duplicate_slug_rejected(system):
    _create(system)
    system.commit()
    with pytest.raises(SlugTaken):
        _create(system)


@pytest.mark.parametrize(
    ("plan", "seats"),
    [(Plan.SOLO, 2), (Plan.SMALL, 1), (Plan.SMALL, 6), (Plan.LARGE, 5), (Plan.SOLO, 0)],
)
def test_plan_seat_rules_reject_invalid(system, plan, seats):
    with pytest.raises(InvalidInput):
        _create(system, plan=plan, seat_limit=seats)


@pytest.mark.parametrize(
    ("plan", "seats"),
    [(Plan.SOLO, 1), (Plan.SMALL, 5), (Plan.LARGE, 6), (Plan.LARGE, 40)],
)
def test_plan_seat_rules_accept_valid(system, plan, seats):
    agency, _ = _create(system, plan=plan, seat_limit=seats)
    assert agency.seat_limit == seats


def test_phone_is_normalised_and_unique_across_agencies(system, make_agency):
    make_agency("first", manager_phone="09121112233")
    with pytest.raises(PhoneTaken):
        _create(system, slug="second", manager_phone="+98 912 111 2233")


def test_invalid_phone_rejected(system):
    with pytest.raises(InvalidInput):
        _create(system, manager_phone="12345")


def test_weak_password_rejected(system):
    with pytest.raises(WeakPassword):
        _create(system, manager_password="12345678")


def test_optional_email_unique_case_insensitively(system, make_agency):
    make_agency("first", manager_email="Same@Example.test")
    with pytest.raises(EmailTaken):
        _create(system, slug="second", manager_email="same@example.TEST")


def test_invalid_email_rejected(system):
    with pytest.raises(InvalidInput):
        _create(system, manager_email="not-an-email")


def test_users_without_email_do_not_collide(db, make_agency):
    info = make_agency("noemail", seats=5)
    with tenant_session(info["agency_id"], engine=db) as session:
        _advisor(session)
        _advisor(session)  # both have email=None: allowed
        session.commit()


def test_create_agency_requires_system_session(db, make_agency):
    info = make_agency("first")
    with tenant_session(info["agency_id"], engine=db) as session, pytest.raises(ScopeRequired):
        _create(session, slug="second")


def test_add_user_requires_tenant_session(system):
    with pytest.raises(ScopeRequired):
        _advisor(system)


def test_seat_limit_enforced_and_freed_by_deactivation(db, make_agency):
    info = make_agency("seats", seats=3)  # manager uses 1 of 3
    with tenant_session(info["agency_id"], engine=db) as session:
        first = _advisor(session)
        _advisor(session)
        with pytest.raises(SeatLimitReached):
            _advisor(session)
        deactivate_user(session, first.id)
        _advisor(session)
        session.commit()
        assert len(session.scalars(select(User).where(User.is_active)).all()) == 3


def test_duplicate_phone_in_same_agency_rejected(db, make_agency):
    info = make_agency("dup", seats=5)
    with tenant_session(info["agency_id"], engine=db) as session:
        _advisor(session, phone="09125550000")
        with pytest.raises(PhoneTaken):
            _advisor(session, phone="0098 912 555 0000")


def test_cannot_deactivate_last_manager(db, make_agency):
    info = make_agency("mgr", seats=3)
    with tenant_session(info["agency_id"], engine=db) as session:
        with pytest.raises(LastManager):
            deactivate_user(session, info["manager_id"])
        second = _advisor(session, role=Role.MANAGER)
        deactivate_user(session, info["manager_id"])  # allowed: another manager remains
        with pytest.raises(LastManager):
            deactivate_user(session, second.id)


def test_deactivate_unknown_user(db, make_agency):
    info = make_agency("ghost")
    with tenant_session(info["agency_id"], engine=db) as session, pytest.raises(UserNotFound):
        deactivate_user(session, uuid.uuid4())


def test_list_users_is_scoped(db, make_agency):
    a = make_agency("lista", seats=3)
    make_agency("listb", seats=3)
    with tenant_session(a["agency_id"], engine=db) as session:
        _advisor(session)
        assert len(list_users(session)) == 2


def test_database_rejects_invalid_plan_value(db):
    with pytest.raises(IntegrityError), db.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO agencies (id, name, slug, plan, seat_limit) "
                "VALUES (gen_random_uuid(), 'x', 'bad-plan', 'gold', 1)"
            )
        )


def test_agencies_listed_by_system_session(system, make_agency):
    make_agency("one")
    make_agency("two")
    assert {a.slug for a in system.scalars(select(Agency)).all()} == {"one", "two"}

import pytest
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import aliased

from app.db.models import Plan, Role, User
from app.db.session import new_session, system_session, tenant_session
from app.db.tenancy import TenantViolation
from app.services.agencies import add_user
from tests.conftest import PASSWORD


@pytest.fixture
def two_agencies(db, make_agency):
    a = make_agency("alpha", plan=Plan.SMALL, seats=4)
    b = make_agency("beta", plan=Plan.SMALL, seats=4)
    a_id, a_mgr, b_id, b_mgr = a["agency_id"], a["manager_id"], b["agency_id"], b["manager_id"]
    with tenant_session(a_id, engine=db) as s:
        add_user(
            s, phone="09120001111", full_name="Alpha Advisor", role=Role.ADVISOR, password=PASSWORD
        )
        s.commit()
    with tenant_session(b_id, engine=db) as s:
        add_user(
            s, phone="09120002222", full_name="Beta Advisor", role=Role.ADVISOR, password=PASSWORD
        )
        s.commit()
    return {"a": a_id, "b": b_id, "a_mgr": a_mgr, "b_mgr": b_mgr}


def test_tenant_select_sees_only_own_rows(db, two_agencies):
    with tenant_session(two_agencies["a"], engine=db) as s:
        names = {u.full_name for u in s.scalars(select(User)).all()}
    assert names == {"Manager", "Alpha Advisor"}


def test_tenant_get_of_foreign_row_returns_none(db, two_agencies):
    with tenant_session(two_agencies["a"], engine=db) as s:
        assert s.get(User, two_agencies["b_mgr"]) is None
        assert s.get(User, two_agencies["a_mgr"]) is not None


def test_tenant_count_and_aliases_are_scoped(db, two_agencies):
    with tenant_session(two_agencies["b"], engine=db) as s:
        assert s.scalar(select(func.count()).select_from(User)) == 2
        alias = aliased(User)
        assert len(s.scalars(select(alias)).all()) == 2


def test_no_scope_fails_closed_on_read(db, two_agencies):
    with new_session(engine=db) as s:
        assert s.scalars(select(User)).all() == []
        assert s.get(User, two_agencies["a_mgr"]) is None


def test_no_scope_refuses_writes(db, two_agencies):
    with new_session(engine=db) as s:
        s.add(
            User(
                agency_id=two_agencies["a"], phone="+989129990000", full_name="X", role=Role.ADVISOR
            )
        )
        with pytest.raises(TenantViolation):
            s.flush()


def test_new_rows_get_the_scope_agency(db, two_agencies):
    with tenant_session(two_agencies["a"], engine=db) as s:
        user = User(phone="+989129990001", full_name="Auto", role=Role.ADVISOR)
        s.add(user)
        s.flush()
        assert user.agency_id == two_agencies["a"]


def test_cannot_create_rows_for_another_agency(db, two_agencies):
    with tenant_session(two_agencies["a"], engine=db) as s:
        s.add(
            User(
                agency_id=two_agencies["b"], phone="+989129990002", full_name="X", role=Role.ADVISOR
            )
        )
        with pytest.raises(TenantViolation):
            s.flush()


def test_cannot_move_a_row_to_another_agency(db, two_agencies):
    with tenant_session(two_agencies["a"], engine=db) as s:
        user = s.get(User, two_agencies["a_mgr"])
        user.agency_id = two_agencies["b"]
        with pytest.raises(TenantViolation):
            s.flush()


def test_bulk_update_is_scoped(db, two_agencies):
    with tenant_session(two_agencies["a"], engine=db) as s:
        s.execute(update(User).values(full_name="Renamed"))
        s.commit()
    with system_session(engine=db) as s:
        names = {u.phone: u.full_name for u in s.scalars(select(User)).all()}
    assert names["+989120001111"] == "Renamed"
    assert names["+989120002222"] == "Beta Advisor"
    assert sorted(names.values()) == ["Beta Advisor", "Manager", "Renamed", "Renamed"]


def test_bulk_delete_is_scoped(db, two_agencies):
    with tenant_session(two_agencies["a"], engine=db) as s:
        s.execute(delete(User))
        s.commit()
    with system_session(engine=db) as s:
        left = {u.full_name for u in s.scalars(select(User)).all()}
    assert left == {"Manager", "Beta Advisor"}


def test_system_scope_sees_everything(db, two_agencies):
    with system_session(engine=db) as s:
        assert s.scalar(select(func.count()).select_from(User)) == 4

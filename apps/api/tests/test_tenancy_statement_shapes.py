"""Tenant filter regression suite: every shape of query we use must stay inside one agency.

The ORM-level filter (app/db/tenancy.py) is the first layer. These tests run each *shape* of
statement from an agency that owns nothing and expect to see nothing. A shape that leaks is listed
in UNSAFE_SHAPES (strict xfail): never write it, and if SQLAlchemy ever starts scoping it, the
test fails and tells us to move it to SAFE_SHAPES.
"""

import pytest
from sqlalchemy import exists, func, select

from app.db.models import Property, PropertyFavorite, PropertyHistory, Role, User
from app.db.session import tenant_session
from app.services import properties as svc
from tests.conftest import make_ctx, prop_values


@pytest.fixture
def two_agencies(db, make_agency, city_ids):
    owner = make_agency("shape-a")
    outsider = make_agency("shape-b")
    ctx = make_ctx(owner["agency_id"], owner["manager_id"], Role.MANAGER)
    with tenant_session(owner["agency_id"], engine=db) as s:
        prop = svc.create_property(s, ctx, prop_values(city_ids["mashhad"]))
        svc.toggle_favorite(s, ctx, prop.id)
        s.commit()
    return {"outsider": outsider["agency_id"], "owner": owner["agency_id"], "prop": prop.id}


SAFE_SHAPES = {
    "entity": lambda: select(Property),
    "column": lambda: select(Property.id),
    "two columns": lambda: select(Property.id, Property.deal_type),
    "count select_from": lambda: select(func.count()).select_from(Property),
    "count with where": lambda: select(func.count()).where(Property.status == "active"),
    "count filter with select_from": lambda: select(
        func.count().filter(Property.status == "active")
    ).select_from(Property),
    "group by": lambda: select(Property.deal_type, func.count()).group_by(Property.deal_type),
    "scalar subquery": lambda: select(select(func.count()).select_from(Property).scalar_subquery()),
    "in subquery": lambda: select(User.id).where(User.id.in_(select(Property.owner_user_id))),
    "exists": lambda: select(User.id).where(exists().where(Property.owner_user_id == User.id)),
    "join": lambda: select(Property.id).join(User, User.id == Property.owner_user_id),
    "history": lambda: select(PropertyHistory.id),
    "favorites": lambda: select(PropertyFavorite.property_id),
    "max aggregate": lambda: select(func.max(Property.created_at)),
}

UNSAFE_SHAPES = {
    "count filter without select_from": lambda: select(
        func.count().filter(Property.status == "active")
    ),
}


def _leaks(db, agency_id, make_statement) -> list:
    with tenant_session(agency_id, engine=db) as s:
        rows = s.execute(make_statement()).all()
    return [v for row in rows for v in row if v not in (0, None)]


@pytest.mark.parametrize("name", list(SAFE_SHAPES))
def test_safe_shapes_cannot_see_another_agency(db, two_agencies, name):
    assert _leaks(db, two_agencies["outsider"], SAFE_SHAPES[name]) == []


@pytest.mark.parametrize("name", list(SAFE_SHAPES))
def test_safe_shapes_do_see_their_own_data(db, two_agencies, name):
    assert _leaks(db, two_agencies["owner"], SAFE_SHAPES[name]) != [], (
        "shape returns nothing at all"
    )


@pytest.mark.parametrize("name", list(UNSAFE_SHAPES))
@pytest.mark.xfail(strict=True, reason="known leak: name the table with select_from()")
def test_unsafe_shapes_are_documented(db, two_agencies, name):
    assert _leaks(db, two_agencies["outsider"], UNSAFE_SHAPES[name]) == []

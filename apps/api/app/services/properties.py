"""Business rules for property files (ADR-0011). Services flush; the caller commits.

Visibility: a manager sees every file of the agency; an advisor sees their own files and the ones a
manager shared with the agency. Soft-deleted files are invisible to everyone. Invisible, foreign and
non-existent files all look the same (PropertyNotFound), so nothing leaks.
"""

import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from app.core.errors import (
    CityNotFound,
    Forbidden,
    InvalidInput,
    PropertyNotFound,
    ScopeRequired,
    UserNotFound,
    VersionConflict,
)
from app.core.phone import normalize_phone
from app.core.text import normalize_text
from app.db.models import (
    City,
    Property,
    PropertyFavorite,
    PropertyHistory,
    Province,
    Role,
    User,
)
from app.db.tenancy import get_scope
from app.domain import vocab
from app.services.auth import AuthContext

MAX_PAGE_SIZE = 200
DEFAULT_PAGE_SIZE = 50

# Fields copied from the client payload onto the model, and tracked in the history.
TRACKED_FIELDS = (
    "deal_type",
    "property_types",
    "city_id",
    "district",
    "address",
    "location_url",
    "land_area_m2",
    "built_area_m2",
    "rooms",
    "floor",
    "total_floors",
    "total_units",
    "build_year",
    "direction",
    "is_corner",
    "amenities",
    "custom_amenities",
    "document_type",
    "document_note",
    "ownership_dang",
    "occupancy",
    "vacate_date",
    "owner_name",
    "owner_phone",
    "price_total",
    "price_per_m2",
    "deposit",
    "monthly_rent",
    "convertible_options",
    "price_note",
    "contract_end_date",
    "delivery_date",
    "payment_terms",
    "is_urgent",
    "urgent_until",
    "notes",
)


def _today() -> date:
    return datetime.now(UTC).date()


def _is_manager(actor: AuthContext) -> bool:
    return actor.role is Role.MANAGER


def _require_tenant(session: Session) -> None:
    if not isinstance(get_scope(session), uuid.UUID):
        raise ScopeRequired("this operation needs a tenant session")


# ----------------------------------------------------------------------------- visibility
def _visible_filter(actor: AuthContext) -> list[Any]:
    conditions: list[Any] = [Property.deleted_at.is_(None)]
    if not _is_manager(actor):
        conditions.append(
            or_(Property.owner_user_id == actor.user_id, Property.shared_with_agency.is_(True))
        )
    return conditions


def _load_visible(session: Session, actor: AuthContext, property_id: uuid.UUID) -> Property:
    _require_tenant(session)
    prop = session.scalar(
        select(Property).where(Property.id == property_id, *_visible_filter(actor))
    )
    if prop is None:
        raise PropertyNotFound("file not found")
    return prop


def can_edit(actor: AuthContext, prop: Property) -> bool:
    return _is_manager(actor) or prop.owner_user_id == actor.user_id


def _load_editable(session: Session, actor: AuthContext, property_id: uuid.UUID) -> Property:
    prop = _load_visible(session, actor, property_id)
    if not can_edit(actor, prop):
        raise Forbidden("only the owner of the file or a manager can change it")
    return prop


# ----------------------------------------------------------------------------- normalisation
def _clean_str(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _round_money(value: Decimal) -> int:
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def _apply_deal_rules(values: dict[str, Any]) -> None:
    """Drop fields that do not belong to the deal type, and complete the sale price pair."""
    deal = values["deal_type"]
    if deal in ("sale", "presale"):
        values["deposit"] = None
        values["monthly_rent"] = None
        values["convertible_options"] = []
        values["contract_end_date"] = None
        area = values.get("built_area_m2") or values.get("land_area_m2")
        total, per_m2 = values.get("price_total"), values.get("price_per_m2")
        if area and area > 0:
            if total is not None and per_m2 is None:
                per_m2 = _round_money(Decimal(total) / Decimal(area))
            elif per_m2 is not None and total is None:
                total = _round_money(Decimal(per_m2) * Decimal(area))
        values["price_total"], values["price_per_m2"] = total, per_m2
    else:
        values["price_total"] = None
        values["price_per_m2"] = None
        if deal == "mortgage":
            values["monthly_rent"] = None
    if deal != "presale":
        values["delivery_date"] = None
        values["payment_terms"] = None
    if not values.get("is_urgent"):
        values["urgent_until"] = None


def _prepare(values: dict[str, Any]) -> dict[str, Any]:
    out = {name: values[name] for name in TRACKED_FIELDS if name in values}
    for name in (
        "district",
        "address",
        "location_url",
        "document_note",
        "owner_name",
        "price_note",
        "payment_terms",
        "notes",
    ):
        out[name] = _clean_str(out.get(name))
    phone = _clean_str(out.get("owner_phone"))
    out["owner_phone"] = normalize_phone(phone, allow_landline=True) if phone else None
    out["convertible_options"] = [
        {"deposit": o["deposit"], "monthly_rent": o["monthly_rent"]}
        if isinstance(o, dict)
        else {"deposit": o.deposit, "monthly_rent": o.monthly_rent}
        for o in out.get("convertible_options") or []
    ]
    _apply_deal_rules(out)
    return out


def _local_phone(e164: str | None) -> str:
    return "0" + e164[3:] if e164 and e164.startswith("+98") else (e164 or "")


def _search_text(city: City, province: Province, values: dict[str, Any]) -> str:
    parts = [
        city.name,
        province.name,
        values.get("district"),
        values.get("address"),
        values.get("notes"),
        values.get("owner_name"),
        values.get("owner_phone"),
        _local_phone(values.get("owner_phone")),
        " ".join(values.get("custom_amenities") or []),
    ]
    return normalize_text(" ".join(p for p in parts if p))


def _city_and_province(session: Session, city_id: int) -> tuple[City, Province]:
    row = session.execute(
        select(City, Province)
        .join(Province, Province.id == City.province_id)
        .where(City.id == city_id)
    ).first()
    if row is None:
        raise CityNotFound("unknown city")
    return row[0], row[1]


def _json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, date):
        return value.isoformat()
    return value


def _record(
    session: Session,
    actor: AuthContext,
    prop: Property,
    action: str,
    changes: dict[str, Any] | None = None,
) -> None:
    session.add(
        PropertyHistory(
            property_id=prop.id, user_id=actor.user_id, action=action, changes=changes or {}
        )
    )


# ----------------------------------------------------------------------------- create / update
def create_property(
    session: Session,
    actor: AuthContext,
    values: dict[str, Any],
    *,
    owner_user_id: uuid.UUID | None = None,
) -> Property:
    _require_tenant(session)
    owner_id = actor.user_id
    if owner_user_id is not None and owner_user_id != actor.user_id:
        if not _is_manager(actor):
            raise Forbidden("only a manager can create a file for someone else")
        owner = session.get(User, owner_user_id)
        if owner is None or not owner.is_active:
            raise UserNotFound("user not found")
        owner_id = owner.id

    data = _prepare(values)
    city, province = _city_and_province(session, data["city_id"])
    prop = Property(
        owner_user_id=owner_id,
        search_text=_search_text(city, province, data),
        **data,
    )
    session.add(prop)
    session.flush()
    _record(session, actor, prop, "create")
    session.flush()
    session.refresh(prop)
    return prop


def update_property(
    session: Session,
    actor: AuthContext,
    property_id: uuid.UUID,
    values: dict[str, Any],
    *,
    expected_version: int,
) -> Property:
    prop = _load_editable(session, actor, property_id)
    if prop.version != expected_version:
        raise VersionConflict("this file was changed by someone else; reload it and try again")

    data = _prepare(values)
    changes: dict[str, Any] = {}
    for name, new in data.items():
        old = getattr(prop, name)
        if old != new:
            changes[name] = {"from": _json_safe(old), "to": _json_safe(new)}
    if not changes:
        return prop

    city, province = _city_and_province(session, data["city_id"])
    for name, new in data.items():
        setattr(prop, name, new)
    prop.search_text = _search_text(city, province, data)
    prop.last_confirmed_at = datetime.now(UTC)
    _record(session, actor, prop, "update", changes)
    try:
        session.flush()
    except StaleDataError as exc:
        raise VersionConflict(
            "this file was changed by someone else; reload it and try again"
        ) from exc
    session.refresh(prop)
    return prop


# ----------------------------------------------------------------------------- state changes
def set_status(
    session: Session,
    actor: AuthContext,
    property_id: uuid.UUID,
    status: str,
    deal_date: date | None = None,
) -> Property:
    if status not in vocab.keys(vocab.STATUSES):
        raise InvalidInput("unknown status")
    prop = _load_editable(session, actor, property_id)
    if prop.status == status:
        return prop
    old = prop.status
    prop.status = status
    prop.deal_date = (deal_date or _today()) if status == "closed" else None
    _record(session, actor, prop, "status", {"status": {"from": old, "to": status}})
    session.flush()
    session.refresh(prop)
    return prop


def soft_delete(session: Session, actor: AuthContext, property_id: uuid.UUID) -> None:
    if not _is_manager(actor):
        raise Forbidden("only a manager can delete files")
    prop = _load_visible(session, actor, property_id)
    prop.deleted_at = datetime.now(UTC)
    prop.deleted_by_user_id = actor.user_id
    _record(session, actor, prop, "delete")
    session.flush()


def set_shared(
    session: Session, actor: AuthContext, property_id: uuid.UUID, shared: bool
) -> Property:
    if not _is_manager(actor):
        raise Forbidden("only a manager can share files")
    prop = _load_visible(session, actor, property_id)
    if prop.shared_with_agency != shared:
        prop.shared_with_agency = shared
        _record(
            session,
            actor,
            prop,
            "share",
            {"shared_with_agency": {"from": not shared, "to": shared}},
        )
        session.flush()
        session.refresh(prop)
    return prop


def reassign(
    session: Session, actor: AuthContext, property_id: uuid.UUID, new_owner_id: uuid.UUID
) -> Property:
    if not _is_manager(actor):
        raise Forbidden("only a manager can reassign files")
    prop = _load_visible(session, actor, property_id)
    owner = session.get(User, new_owner_id)
    if owner is None or not owner.is_active:
        raise UserNotFound("user not found")
    if prop.owner_user_id != owner.id:
        old = prop.owner_user_id
        prop.owner_user_id = owner.id
        _record(
            session,
            actor,
            prop,
            "reassign",
            {"owner_user_id": {"from": str(old), "to": str(owner.id)}},
        )
        session.flush()
        session.refresh(prop)
    return prop


def toggle_favorite(session: Session, actor: AuthContext, property_id: uuid.UUID) -> bool:
    prop = _load_visible(session, actor, property_id)
    existing = session.get(PropertyFavorite, (actor.user_id, prop.id))
    if existing is not None:
        session.delete(existing)
        session.flush()
        return False
    session.add(PropertyFavorite(user_id=actor.user_id, property_id=prop.id))
    session.flush()
    return True


# ----------------------------------------------------------------------------- reading
def get_property(session: Session, actor: AuthContext, property_id: uuid.UUID) -> Property:
    return _load_visible(session, actor, property_id)


def list_history(
    session: Session, actor: AuthContext, property_id: uuid.UUID
) -> list[tuple[PropertyHistory, User]]:
    prop = _load_visible(session, actor, property_id)
    rows = session.execute(
        select(PropertyHistory, User)
        .join(User, User.id == PropertyHistory.user_id)
        .where(PropertyHistory.property_id == prop.id)
        .order_by(PropertyHistory.created_at.desc(), PropertyHistory.id)
    ).all()
    return [(r[0], r[1]) for r in rows]


@dataclass
class PropertyFilters:
    status: str = "active"  # active | inactive | closed | any
    deal_types: list[str] = field(default_factory=list)
    property_types: list[str] = field(default_factory=list)  # any of
    city_id: int | None = None
    province_id: int | None = None
    district: str | None = None
    min_area: float | None = None
    max_area: float | None = None
    min_rooms: int | None = None
    max_rooms: int | None = None
    min_floor: int | None = None
    max_floor: int | None = None
    min_build_year: int | None = None
    max_build_year: int | None = None
    min_total_units: int | None = None
    max_total_units: int | None = None
    directions: list[str] = field(default_factory=list)
    is_corner: bool | None = None
    document_types: list[str] = field(default_factory=list)
    occupancy: list[str] = field(default_factory=list)
    amenities_all: list[str] = field(default_factory=list)
    amenities_none: list[str] = field(default_factory=list)
    min_price: int | None = None
    max_price: int | None = None
    min_price_per_m2: int | None = None
    max_price_per_m2: int | None = None
    min_deposit: int | None = None
    max_deposit: int | None = None
    min_rent: int | None = None
    max_rent: int | None = None
    contract_ends_within_days: int | None = None
    urgent_only: bool = False
    favorites_only: bool = False
    owner_user_id: uuid.UUID | None = None  # managers only
    shared_only: bool = False
    search: str | None = None


def _like_escape(token: str) -> str:
    return token.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _district_key() -> Any:
    """SQL expression: the stored district in the same normal form as normalize_text()."""
    key = func.lower(Property.district)
    for old, new in (("\u200c", " "), ("ي", "ی"), ("ك", "ک")):
        key = func.replace(key, old, new)
    return key


def _urgent_condition(today: date) -> Any:
    return or_(
        and_(
            Property.is_urgent.is_(True),
            or_(Property.urgent_until.is_(None), Property.urgent_until >= today),
        ),
        and_(
            Property.contract_end_date.is_not(None),
            Property.contract_end_date >= today,
            Property.contract_end_date <= today + timedelta(days=7),
        ),
    )


def is_urgent_now(prop: Property, today: date | None = None) -> bool:
    today = today or _today()
    flagged = prop.is_urgent and (prop.urgent_until is None or prop.urgent_until >= today)
    ending = (
        prop.contract_end_date is not None
        and today <= prop.contract_end_date <= today + timedelta(days=7)
    )
    return bool(flagged or ending)


def _apply_filters(stmt: Select, actor: AuthContext, f: PropertyFilters) -> Select:
    today = _today()
    stmt = stmt.where(*_visible_filter(actor))
    if f.status != "any":
        stmt = stmt.where(Property.status == f.status)
    if f.deal_types:
        stmt = stmt.where(Property.deal_type.in_(f.deal_types))
    if f.property_types:
        stmt = stmt.where(Property.property_types.overlap(f.property_types))
    if f.city_id is not None:
        stmt = stmt.where(Property.city_id == f.city_id)
    if f.province_id is not None:
        stmt = stmt.where(
            Property.city_id.in_(select(City.id).where(City.province_id == f.province_id))
        )
    if f.district:
        stmt = stmt.where(
            _district_key().like(f"%{_like_escape(normalize_text(f.district))}%", escape="\\")
        )
    ranges = (
        (Property.main_area_m2, f.min_area, f.max_area),
        (Property.rooms, f.min_rooms, f.max_rooms),
        (Property.floor, f.min_floor, f.max_floor),
        (Property.build_year, f.min_build_year, f.max_build_year),
        (Property.total_units, f.min_total_units, f.max_total_units),
        (Property.sort_price, f.min_price, f.max_price),
        (Property.price_per_m2, f.min_price_per_m2, f.max_price_per_m2),
        (Property.deposit, f.min_deposit, f.max_deposit),
        (Property.monthly_rent, f.min_rent, f.max_rent),
    )
    for column, low, high in ranges:
        if low is not None:
            stmt = stmt.where(column >= low)
        if high is not None:
            stmt = stmt.where(column <= high)
    if f.directions:
        stmt = stmt.where(Property.direction.in_(f.directions))
    if f.is_corner is not None:
        stmt = stmt.where(Property.is_corner.is_(f.is_corner))
    if f.document_types:
        stmt = stmt.where(Property.document_type.in_(f.document_types))
    if f.occupancy:
        stmt = stmt.where(Property.occupancy.in_(f.occupancy))
    if f.amenities_all:
        stmt = stmt.where(Property.amenities.contains(f.amenities_all))
    if f.amenities_none:
        stmt = stmt.where(~Property.amenities.overlap(f.amenities_none))
    if f.contract_ends_within_days is not None:
        stmt = stmt.where(
            Property.contract_end_date.is_not(None),
            Property.contract_end_date <= today + timedelta(days=f.contract_ends_within_days),
        )
    if f.urgent_only:
        stmt = stmt.where(_urgent_condition(today))
    if f.favorites_only:
        stmt = stmt.where(
            Property.id.in_(
                select(PropertyFavorite.property_id).where(
                    PropertyFavorite.user_id == actor.user_id
                )
            )
        )
    if f.owner_user_id is not None and _is_manager(actor):
        stmt = stmt.where(Property.owner_user_id == f.owner_user_id)
    if f.shared_only:
        stmt = stmt.where(Property.shared_with_agency.is_(True))
    if f.search:
        for token in normalize_text(f.search).split():
            stmt = stmt.where(Property.search_text.like(f"%{_like_escape(token)}%", escape="\\"))
    return stmt


_SORT_COLUMNS = {
    "created_at": Property.created_at,
    "updated_at": Property.updated_at,
    "price": Property.sort_price,
    "area": Property.main_area_m2,
    "contract_end_date": Property.contract_end_date,
}


def list_properties(
    session: Session,
    actor: AuthContext,
    filters: PropertyFilters,
    *,
    sort_by: str = "created_at",
    descending: bool = True,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> tuple[list[Property], int, int, int]:
    """Returns (items, total, page, page_size)."""
    _require_tenant(session)
    if sort_by not in _SORT_COLUMNS:
        raise InvalidInput(f"sort_by must be one of: {', '.join(_SORT_COLUMNS)}")
    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)

    base = _apply_filters(select(Property), actor, filters)
    total = session.scalar(select(func.count()).select_from(base.order_by(None).subquery())) or 0
    column = _SORT_COLUMNS[sort_by]
    ordering = column.desc().nulls_last() if descending else column.asc().nulls_last()
    items = list(
        session.scalars(
            base.order_by(ordering, Property.id).offset((page - 1) * page_size).limit(page_size)
        )
    )
    return items, total, page, page_size


def favorite_ids(
    session: Session, actor: AuthContext, property_ids: list[uuid.UUID]
) -> set[uuid.UUID]:
    if not property_ids:
        return set()
    rows = session.scalars(
        select(PropertyFavorite.property_id).where(
            PropertyFavorite.user_id == actor.user_id,
            PropertyFavorite.property_id.in_(property_ids),
        )
    )
    return set(rows)


def lookup_cities(session: Session, city_ids: set[int]) -> dict[int, tuple[City, Province]]:
    if not city_ids:
        return {}
    rows = session.execute(
        select(City, Province)
        .join(Province, Province.id == City.province_id)
        .where(City.id.in_(city_ids))
    ).all()
    return {r[0].id: (r[0], r[1]) for r in rows}


def lookup_users(session: Session, user_ids: set[uuid.UUID]) -> dict[uuid.UUID, User]:
    if not user_ids:
        return {}
    return {u.id: u for u in session.scalars(select(User).where(User.id.in_(user_ids)))}


# ----------------------------------------------------------------------------- similar files
def find_similar(
    session: Session,
    actor: AuthContext,
    *,
    owner_phone: str | None = None,
    city_id: int | None = None,
    address: str | None = None,
    exclude_id: uuid.UUID | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Possible duplicates across the agency; details of files the caller cannot see are hidden."""
    _require_tenant(session)
    phone = _clean_str(owner_phone)
    normalized_phone = normalize_phone(phone, allow_landline=True) if phone else None
    address_key = normalize_text(address)

    conditions = []
    if normalized_phone:
        conditions.append(Property.owner_phone == normalized_phone)
    if city_id is not None and address_key:
        conditions.append(
            and_(
                Property.city_id == city_id, func.lower(func.btrim(Property.address)) == address_key
            )
        )
    if not conditions:
        return []

    stmt = (
        select(Property, User.full_name, City.name)
        .join(User, User.id == Property.owner_user_id)
        .join(City, City.id == Property.city_id)
        .where(Property.deleted_at.is_(None), Property.status == "active", or_(*conditions))
        .order_by(Property.created_at.desc())
        .limit(limit)
    )
    if exclude_id is not None:
        stmt = stmt.where(Property.id != exclude_id)

    visible_ids = {
        p
        for p in session.scalars(
            select(Property.id).where(
                *_visible_filter(actor), Property.id.in_([r[0].id for r in session.execute(stmt)])
            )
        )
    }
    results = []
    for prop, advisor_name, city_name in session.execute(stmt):
        can_see = prop.id in visible_ids
        same_phone = bool(normalized_phone and prop.owner_phone == normalized_phone)
        results.append(
            {
                "kind": "phone" if same_phone else "address",
                "deal_type": prop.deal_type,
                "city_name": city_name,
                "advisor_name": advisor_name,
                "property_id": prop.id if can_see else None,
                "owner_name": prop.owner_name if can_see else None,
                "owner_phone": prop.owner_phone if can_see else None,
            }
        )
    return results


# ----------------------------------------------------------------------------- statistics
def stats(session: Session, actor: AuthContext) -> dict[str, Any]:
    _require_tenant(session)
    today = _today()
    # Aggregates must name their table (select_from) so the tenant filter sees them, and carry an
    # explicit agency condition as a second guard (see tests/test_tenancy_statement_shapes.py).
    base = and_(
        Property.agency_id == actor.agency_id, *_visible_filter(actor), Property.status == "active"
    )
    week_ago = datetime.now(UTC) - timedelta(days=7)
    row = session.execute(
        select(
            func.count().filter(base),
            func.count().filter(and_(base, Property.created_at >= week_ago)),
            func.count().filter(and_(base, _urgent_condition(today))),
            func.count().filter(and_(base, Property.contract_end_date < today)),
            func.count().filter(
                and_(base, Property.contract_end_date.between(today, today + timedelta(days=7)))
            ),
            func.count().filter(
                and_(base, Property.contract_end_date.between(today, today + timedelta(days=30)))
            ),
        ).select_from(Property)
    ).one()
    by_deal = dict(
        session.execute(
            select(Property.deal_type, func.count()).where(base).group_by(Property.deal_type)
        ).all()
    )
    return {
        "total_active": row[0],
        "by_deal_type": {k: by_deal.get(k, 0) for k in vocab.keys(vocab.DEAL_TYPES)},
        "new_this_week": row[1],
        "urgent": row[2],
        "contracts_overdue": row[3],
        "contracts_ending_7_days": row[4],
        "contracts_ending_30_days": row[5],
    }


# ----------------------------------------------------------------------------- geography helpers
def search_cities(
    session: Session, *, province_id: int | None, query: str | None, limit: int = 30
) -> list[tuple[City, Province]]:
    stmt = select(City, Province).join(Province, Province.id == City.province_id)
    if province_id is not None:
        stmt = stmt.where(City.province_id == province_id)
    if query:
        stmt = stmt.where(
            City.name_normalized.like(f"{_like_escape(normalize_text(query))}%", escape="\\")
        )
    rows = session.execute(stmt.order_by(City.name).limit(min(limit, 100))).all()
    return [(r[0], r[1]) for r in rows]


def suggest_districts(
    session: Session, *, city_id: int, query: str | None, limit: int = 20
) -> list[str]:
    """Districts already used by this agency in that city (autocomplete)."""
    _require_tenant(session)
    stmt = select(Property.district).where(
        Property.city_id == city_id, Property.district.is_not(None), Property.deleted_at.is_(None)
    )
    if query:
        stmt = stmt.where(
            _district_key().like(f"{_like_escape(normalize_text(query))}%", escape="\\")
        )
    return list(
        session.scalars(stmt.group_by(Property.district).order_by(func.count().desc()).limit(limit))
    )

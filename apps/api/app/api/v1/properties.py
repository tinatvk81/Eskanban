import math
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_context, get_data_db, require_manager
from app.db.models import Property
from app.schemas.properties import (
    CityRef,
    HistoryOut,
    PersonRef,
    PropertyCreate,
    PropertyListOut,
    PropertyOut,
    PropertyUpdate,
    ReassignChange,
    ShareChange,
    SimilarOut,
    StatsOut,
    StatusChange,
)
from app.services import properties as svc
from app.services.auth import AuthContext

router = APIRouter(prefix="/properties", tags=["properties"])


def _serialize(db: Session, actor: AuthContext, props: list[Property]) -> list[PropertyOut]:
    cities = svc.lookup_cities(db, {p.city_id for p in props})
    users = svc.lookup_users(db, {p.owner_user_id for p in props})
    favorites = svc.favorite_ids(db, actor, [p.id for p in props])
    today = date.today()
    out = []
    for p in props:
        city, province = cities[p.city_id]
        owner = users[p.owner_user_id]
        data = PropertyOut.model_validate(
            {
                **{
                    c.key: getattr(p, c.key)
                    for c in p.__table__.columns
                    if c.key in PropertyOut.model_fields
                },
                "owner": PersonRef(id=owner.id, full_name=owner.full_name),
                "city": CityRef(
                    id=city.id, name=city.name, province_id=province.id, province_name=province.name
                ),
                "can_edit": svc.can_edit(actor, p),
                "is_favorite": p.id in favorites,
                "is_urgent_now": svc.is_urgent_now(p, today),
            }
        )
        out.append(data)
    return out


def _one(db: Session, actor: AuthContext, prop: Property) -> PropertyOut:
    return _serialize(db, actor, [prop])[0]


@router.get("", response_model=PropertyListOut)
def list_properties(
    status_: str = Query(
        default="active", alias="status", pattern="^(active|inactive|closed|any)$"
    ),
    deal_type: list[str] = Query(default=[]),
    property_type: list[str] = Query(default=[]),
    city_id: int | None = None,
    province_id: int | None = None,
    district: str | None = Query(default=None, max_length=80),
    min_area: float | None = Query(default=None, ge=0),
    max_area: float | None = Query(default=None, ge=0),
    min_rooms: int | None = None,
    max_rooms: int | None = None,
    min_floor: int | None = None,
    max_floor: int | None = None,
    min_build_year: int | None = None,
    max_build_year: int | None = None,
    min_total_units: int | None = None,
    max_total_units: int | None = None,
    direction: list[str] = Query(default=[]),
    is_corner: bool | None = None,
    document_type: list[str] = Query(default=[]),
    occupancy: list[str] = Query(default=[]),
    amenity: list[str] = Query(default=[], description="file must have ALL of these"),
    without_amenity: list[str] = Query(default=[], description="file must have NONE of these"),
    min_price: int | None = Query(default=None, ge=0),
    max_price: int | None = Query(default=None, ge=0),
    min_price_per_m2: int | None = Query(default=None, ge=0),
    max_price_per_m2: int | None = Query(default=None, ge=0),
    min_deposit: int | None = Query(default=None, ge=0),
    max_deposit: int | None = Query(default=None, ge=0),
    min_rent: int | None = Query(default=None, ge=0),
    max_rent: int | None = Query(default=None, ge=0),
    contract_ends_within_days: int | None = Query(default=None, ge=0, le=3650),
    urgent_only: bool = False,
    favorites_only: bool = False,
    shared_only: bool = False,
    owner_user_id: uuid.UUID | None = None,
    search: str | None = Query(default=None, max_length=100),
    sort_by: str = "created_at",
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=svc.DEFAULT_PAGE_SIZE, ge=1, le=svc.MAX_PAGE_SIZE),
    ctx: AuthContext = Depends(get_context),
    db: Session = Depends(get_data_db),
) -> PropertyListOut:
    filters = svc.PropertyFilters(
        status=status_,
        deal_types=deal_type,
        property_types=property_type,
        city_id=city_id,
        province_id=province_id,
        district=district,
        min_area=min_area,
        max_area=max_area,
        min_rooms=min_rooms,
        max_rooms=max_rooms,
        min_floor=min_floor,
        max_floor=max_floor,
        min_build_year=min_build_year,
        max_build_year=max_build_year,
        min_total_units=min_total_units,
        max_total_units=max_total_units,
        directions=direction,
        is_corner=is_corner,
        document_types=document_type,
        occupancy=occupancy,
        amenities_all=amenity,
        amenities_none=without_amenity,
        min_price=min_price,
        max_price=max_price,
        min_price_per_m2=min_price_per_m2,
        max_price_per_m2=max_price_per_m2,
        min_deposit=min_deposit,
        max_deposit=max_deposit,
        min_rent=min_rent,
        max_rent=max_rent,
        contract_ends_within_days=contract_ends_within_days,
        urgent_only=urgent_only,
        favorites_only=favorites_only,
        shared_only=shared_only,
        owner_user_id=owner_user_id,
        search=search,
    )
    items, total, page, page_size = svc.list_properties(
        db,
        ctx,
        filters,
        sort_by=sort_by,
        descending=order == "desc",
        page=page,
        page_size=page_size,
    )
    return PropertyListOut(
        items=_serialize(db, ctx, items),
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(math.ceil(total / page_size), 1),
    )


@router.get("/stats", response_model=StatsOut)
def get_stats(
    ctx: AuthContext = Depends(get_context), db: Session = Depends(get_data_db)
) -> StatsOut:
    return StatsOut(**svc.stats(db, ctx))


@router.get("/similar", response_model=list[SimilarOut])
def similar(
    owner_phone: str | None = Query(default=None, max_length=32),
    city_id: int | None = None,
    address: str | None = Query(default=None, max_length=255),
    exclude_id: uuid.UUID | None = None,
    ctx: AuthContext = Depends(get_context),
    db: Session = Depends(get_data_db),
) -> list[SimilarOut]:
    """Possible duplicates in the agency. Owner details appear only for files the caller may see."""
    return [
        SimilarOut(**row)
        for row in svc.find_similar(
            db,
            ctx,
            owner_phone=owner_phone,
            city_id=city_id,
            address=address,
            exclude_id=exclude_id,
        )
    ]


@router.post("", response_model=PropertyOut, status_code=status.HTTP_201_CREATED)
def create_property(
    body: PropertyCreate,
    ctx: AuthContext = Depends(get_context),
    db: Session = Depends(get_data_db),
) -> PropertyOut:
    values = body.model_dump(exclude={"owner_user_id"})
    prop = svc.create_property(db, ctx, values, owner_user_id=body.owner_user_id)
    db.commit()
    return _one(db, ctx, prop)


@router.get("/{property_id}", response_model=PropertyOut)
def get_property(
    property_id: uuid.UUID,
    ctx: AuthContext = Depends(get_context),
    db: Session = Depends(get_data_db),
) -> PropertyOut:
    return _one(db, ctx, svc.get_property(db, ctx, property_id))


@router.put("/{property_id}", response_model=PropertyOut)
def update_property(
    property_id: uuid.UUID,
    body: PropertyUpdate,
    ctx: AuthContext = Depends(get_context),
    db: Session = Depends(get_data_db),
) -> PropertyOut:
    prop = svc.update_property(
        db, ctx, property_id, body.model_dump(exclude={"version"}), expected_version=body.version
    )
    db.commit()
    return _one(db, ctx, prop)


@router.post("/{property_id}/status", response_model=PropertyOut)
def change_status(
    property_id: uuid.UUID,
    body: StatusChange,
    ctx: AuthContext = Depends(get_context),
    db: Session = Depends(get_data_db),
) -> PropertyOut:
    prop = svc.set_status(db, ctx, property_id, body.status, body.deal_date)
    db.commit()
    return _one(db, ctx, prop)


@router.post("/{property_id}/favorite")
def toggle_favorite(
    property_id: uuid.UUID,
    ctx: AuthContext = Depends(get_context),
    db: Session = Depends(get_data_db),
) -> dict[str, bool]:
    result = svc.toggle_favorite(db, ctx, property_id)
    db.commit()
    return {"is_favorite": result}


@router.post("/{property_id}/share", response_model=PropertyOut)
def share(
    property_id: uuid.UUID,
    body: ShareChange,
    ctx: AuthContext = Depends(require_manager),
    db: Session = Depends(get_data_db),
) -> PropertyOut:
    prop = svc.set_shared(db, ctx, property_id, body.shared)
    db.commit()
    return _one(db, ctx, prop)


@router.post("/{property_id}/reassign", response_model=PropertyOut)
def reassign(
    property_id: uuid.UUID,
    body: ReassignChange,
    ctx: AuthContext = Depends(require_manager),
    db: Session = Depends(get_data_db),
) -> PropertyOut:
    prop = svc.reassign(db, ctx, property_id, body.owner_user_id)
    db.commit()
    return _one(db, ctx, prop)


@router.post("/{property_id}/soft-delete", status_code=status.HTTP_204_NO_CONTENT)
def soft_delete(
    property_id: uuid.UUID,
    ctx: AuthContext = Depends(require_manager),
    db: Session = Depends(get_data_db),
) -> Response:
    svc.soft_delete(db, ctx, property_id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{property_id}/history", response_model=list[HistoryOut])
def history(
    property_id: uuid.UUID,
    ctx: AuthContext = Depends(get_context),
    db: Session = Depends(get_data_db),
) -> list[HistoryOut]:
    return [
        HistoryOut(
            id=h.id,
            user=PersonRef(id=u.id, full_name=u.full_name),
            action=h.action,
            changes=h.changes,
            created_at=h.created_at,
        )
        for h, u in svc.list_history(db, ctx, property_id)
    ]

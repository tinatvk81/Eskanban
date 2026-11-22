from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_context, get_data_db
from app.schemas.listings import AddFromLinkIn, ListingOut, ListingPage
from app.schemas.properties import PropertyFields
from app.services import listings as svc
from app.services.auth import AuthContext

router = APIRouter(prefix="/listings", tags=["listings"])


def _to_out(inbox, listing) -> ListingOut:
    return ListingOut(
        id=inbox.id, source=listing.source, external_id=listing.external_id, url=listing.url,
        title=listing.title, owner_name=listing.owner_name, owner_phone=listing.owner_phone,
        address=listing.address, city_id=listing.city_id, district=listing.district,
        deal_type=listing.deal_type, property_types=listing.property_types,
        price_total=listing.price_total, deposit=listing.deposit, monthly_rent=listing.monthly_rent,
        posted_at=listing.posted_at, is_gone=listing.is_gone, status=inbox.status,
        converted_property_id=inbox.converted_property_id,
    )


@router.get("", response_model=ListingPage)
def list_listings(
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_data_db),
    ctx: AuthContext = Depends(get_context),
):
    rows, total = svc.list_listings(db, status, page, page_size)
    items = [_to_out(inbox, listing) for inbox, listing in rows]
    total_pages = (total + page_size - 1) // page_size if total else 0
    return ListingPage(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.post("/from-link", response_model=ListingOut, status_code=201)
def add_from_link(
    body: AddFromLinkIn,
    db: Session = Depends(get_data_db),
    ctx: AuthContext = Depends(get_context),
):
    inbox, listing = svc.add_from_link(db, ctx, body.model_dump())
    db.commit()
    return _to_out(inbox, listing)


@router.post("/{listing_id}/dismiss", response_model=ListingOut)
def dismiss(
    listing_id: str,
    db: Session = Depends(get_data_db),
    ctx: AuthContext = Depends(get_context),
):
    inbox, listing = svc.dismiss_listing(db, listing_id)
    db.commit()
    return _to_out(inbox, listing)


@router.post("/{listing_id}/convert", status_code=201)
def convert(
    listing_id: str,
    body: PropertyFields,
    db: Session = Depends(get_data_db),
    ctx: AuthContext = Depends(get_context),
):
    prop = svc.convert_listing(db, ctx, listing_id, body.model_dump())
    db.commit()
    return {"id": str(prop.id)}

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import InvalidInput, ListingNotFound
from app.db.models import ListingInbox, SourceListing
from app.domain import sources as source_registry
from app.services.auth import AuthContext
from app.services.properties import create_property


def add_from_link(session: Session, actor: AuthContext, data: dict[str, Any]) -> tuple[ListingInbox, SourceListing]:
    key = source_registry.detect_from_url(data["url"])
    if key is None:
        raise InvalidInput("could not recognize the source from this link")

    external_id = data["url"]  # S1: the URL itself; a connector will use the site's real ad id
    listing = session.scalar(
        select(SourceListing).where(
            SourceListing.source == key, SourceListing.external_id == external_id
        )
    )
    if listing is None:
        listing = SourceListing(source=key, external_id=external_id, url=data["url"])
        session.add(listing)

    for field in (
        "title", "owner_name", "owner_phone", "address", "city_id", "district",
        "deal_type", "property_types", "price_total", "deposit", "monthly_rent",
    ):
        value = data.get(field)
        if value:
            setattr(listing, field, value)
    session.flush()

    inbox = session.scalar(
        select(ListingInbox).where(ListingInbox.source_listing_id == listing.id)
    )
    if inbox is None:
        inbox = ListingInbox(source_listing_id=listing.id, status="new")
        session.add(inbox)
        session.flush()
    return inbox, listing


def list_listings(session: Session, status: str | None, page: int, page_size: int):
    stmt = select(ListingInbox, SourceListing).join(
        SourceListing, SourceListing.id == ListingInbox.source_listing_id
    )
    if status:
        stmt = stmt.where(ListingInbox.status == status)

    count_stmt = select(func.count()).select_from(ListingInbox).join(
        SourceListing, SourceListing.id == ListingInbox.source_listing_id
    )
    if status:
        count_stmt = count_stmt.where(ListingInbox.status == status)
    total = session.scalar(count_stmt)

    rows = session.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return rows, total


def _get_inbox(session: Session, listing_inbox_id: uuid.UUID) -> ListingInbox:
    inbox = session.get(ListingInbox, listing_inbox_id)
    if inbox is None:
        raise ListingNotFound("listing not found")
    return inbox


def dismiss_listing(session: Session, listing_inbox_id: uuid.UUID) -> tuple[ListingInbox, SourceListing]:
    inbox = _get_inbox(session, listing_inbox_id)
    inbox.status = "dismissed"
    session.flush()
    listing = session.get(SourceListing, inbox.source_listing_id)
    return inbox, listing


def convert_listing(session, actor: AuthContext, listing_inbox_id: uuid.UUID, property_values: dict[str, Any]):
    inbox = _get_inbox(session, listing_inbox_id)
    listing = session.get(SourceListing, inbox.source_listing_id)

    values = {
        "owner_name": listing.owner_name,
        "owner_phone": listing.owner_phone,
        "address": listing.address,
        "city_id": listing.city_id,
        "district": listing.district,
        "deal_type": listing.deal_type,
        "property_types": listing.property_types,
        "price_total": listing.price_total,
        "deposit": listing.deposit,
        "monthly_rent": listing.monthly_rent,
    }
    values.update({k: v for k, v in property_values.items() if v is not None})

    prop = create_property(session, actor, values)
    prop.source = listing.source
    prop.source_url = listing.url

    inbox.status = "converted"
    inbox.converted_property_id = prop.id
    session.flush()
    return prop

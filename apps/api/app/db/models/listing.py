import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.mixins import IdMixin, TenantMixin


class SourceListing(IdMixin, Base):
    """A listing discovered on an external source. Global (not tenant-owned):
    the same public ad is the same row for every agency. Never holds anything
    beyond what the source's own ad page shows."""

    __tablename__ = "source_listings"
    __table_args__ = (Index("ix_source_listings_source_external", "source", "external_id", unique=True),)

    source: Mapped[str] = mapped_column(String(30), nullable=False)
    external_id: Mapped[str] = mapped_column(String(120), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)

    title: Mapped[str | None] = mapped_column(String(255))
    owner_name: Mapped[str | None] = mapped_column(String(120))
    owner_phone: Mapped[str | None] = mapped_column(String(32))
    address: Mapped[str | None] = mapped_column(String(255))

    city_id: Mapped[int | None] = mapped_column(ForeignKey("cities.id"))
    district: Mapped[str | None] = mapped_column(String(80))
    deal_type: Mapped[str | None] = mapped_column(String(20))
    property_types: Mapped[list[str]] = mapped_column(JSONB, nullable=False, server_default="[]")

    price_total: Mapped[int | None] = mapped_column(BigInteger)
    deposit: Mapped[int | None] = mapped_column(BigInteger)
    monthly_rent: Mapped[int | None] = mapped_column(BigInteger)

    posted_at: Mapped[date | None]
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    is_gone: Mapped[bool] = mapped_column(nullable=False, server_default="false")


class ListingInbox(IdMixin, TenantMixin, Base):
    """Per-agency state on a SourceListing: new / dismissed / converted."""

    __tablename__ = "listing_inbox"
    __table_args__ = (
        Index("ix_listing_inbox_agency_source", "agency_id", "source_listing_id", unique=True),
    )

    source_listing_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("source_listings.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="new")
    converted_property_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("properties.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

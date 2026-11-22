import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class ListingOut(BaseModel):
    id: uuid.UUID
    source: str
    external_id: str
    url: str
    title: str | None
    owner_name: str | None
    owner_phone: str | None
    address: str | None
    city_id: int | None
    district: str | None
    deal_type: str | None
    property_types: list[str]
    price_total: int | None
    deposit: int | None
    monthly_rent: int | None
    posted_at: date | None
    is_gone: bool
    status: str  # from listing_inbox: new / dismissed / converted
    converted_property_id: uuid.UUID | None

    model_config = {"from_attributes": True}


class ListingPage(BaseModel):
    items: list[ListingOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class AddFromLinkIn(BaseModel):
    """Manual add in S1 (no connector yet). Only `url` is required; everything
    else is whatever the advisor can see on the source page right now."""

    url: str = Field(max_length=500)
    title: str | None = Field(default=None, max_length=255)
    owner_name: str | None = Field(default=None, max_length=120)
    owner_phone: str | None = Field(default=None, max_length=32)
    address: str | None = Field(default=None, max_length=255)
    city_id: int | None = None
    district: str | None = Field(default=None, max_length=80)
    deal_type: str | None = None
    property_types: list[str] = Field(default_factory=list)
    price_total: int | None = None
    deposit: int | None = None
    monthly_rent: int | None = None

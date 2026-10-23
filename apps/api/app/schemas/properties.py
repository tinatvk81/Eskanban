import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, field_validator

from app.domain import vocab

Area = Annotated[Decimal, Field(ge=0, le=1_000_000, max_digits=10, decimal_places=2)]
Money = Annotated[int, Field(ge=0, le=10**13)]  # whole Toman
AreaOut = Annotated[
    Decimal | None,
    PlainSerializer(lambda v: None if v is None else float(v), return_type=float | None),
]


def _dedupe(values: list[str]) -> list[str]:
    seen: dict[str, None] = {}
    for v in values:
        seen.setdefault(v, None)
    return list(seen)


def _check_keys(values: list[str], items: tuple[vocab.Item, ...], label: str) -> list[str]:
    allowed = set(vocab.keys(items))
    bad = [v for v in values if v not in allowed]
    if bad:
        raise ValueError(f"unknown {label}: {', '.join(bad)}")
    return _dedupe(values)


class ConvertibleOption(BaseModel):
    deposit: Money
    monthly_rent: Money


class PropertyFields(BaseModel):
    """Everything a client may set on a file. PUT replaces all of it."""

    deal_type: str
    property_types: list[str] = Field(default_factory=list, max_length=13)
    city_id: int
    district: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=255)
    location_url: str | None = Field(default=None, max_length=500)

    land_area_m2: Area | None = None
    built_area_m2: Area | None = None
    rooms: int | None = Field(default=None, ge=0, le=100)
    floor: int | None = Field(default=None, ge=-10, le=200)
    total_floors: int | None = Field(default=None, ge=0, le=200)
    total_units: int | None = Field(default=None, ge=0, le=2000)
    build_year: int | None = Field(default=None, ge=1200, le=1600)  # Jalali year
    direction: str | None = None
    is_corner: bool = False
    amenities: list[str] = Field(default_factory=list, max_length=40)
    custom_amenities: list[str] = Field(default_factory=list, max_length=20)

    document_type: str | None = None
    document_note: str | None = Field(default=None, max_length=200)
    ownership_dang: int = Field(default=6, ge=1, le=6)

    occupancy: str | None = None
    vacate_date: date | None = None

    owner_name: str | None = Field(default=None, max_length=120)
    owner_phone: str | None = Field(default=None, max_length=32)

    price_total: Money | None = None
    price_per_m2: Money | None = None
    deposit: Money | None = None
    monthly_rent: Money | None = None
    convertible_options: list[ConvertibleOption] = Field(default_factory=list, max_length=10)
    price_note: str | None = Field(default=None, max_length=500)

    contract_end_date: date | None = None
    delivery_date: date | None = None
    payment_terms: str | None = Field(default=None, max_length=1000)

    is_urgent: bool = False
    urgent_until: date | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("deal_type")
    @classmethod
    def _deal_type(cls, v: str) -> str:
        if v not in vocab.keys(vocab.DEAL_TYPES):
            raise ValueError("unknown deal type")
        return v

    @field_validator("property_types")
    @classmethod
    def _property_types(cls, v: list[str]) -> list[str]:
        return _check_keys(v, vocab.PROPERTY_TYPES, "property type")

    @field_validator("amenities")
    @classmethod
    def _amenities(cls, v: list[str]) -> list[str]:
        return _check_keys(v, vocab.AMENITIES, "amenity")

    @field_validator("custom_amenities")
    @classmethod
    def _custom_amenities(cls, v: list[str]) -> list[str]:
        cleaned = [item.strip() for item in v if item.strip()]
        if any(len(item) > 60 for item in cleaned):
            raise ValueError("custom amenities are limited to 60 characters")
        return _dedupe(cleaned)

    @field_validator("direction")
    @classmethod
    def _direction(cls, v: str | None) -> str | None:
        if v is not None and v not in vocab.keys(vocab.DIRECTIONS):
            raise ValueError("unknown direction")
        return v

    @field_validator("occupancy")
    @classmethod
    def _occupancy(cls, v: str | None) -> str | None:
        if v is not None and v not in vocab.keys(vocab.OCCUPANCY):
            raise ValueError("unknown occupancy")
        return v

    @field_validator("document_type")
    @classmethod
    def _document_type(cls, v: str | None) -> str | None:
        if v is not None and v not in vocab.keys(vocab.DOCUMENT_TYPES):
            raise ValueError("unknown document type")
        return v

    @field_validator("location_url")
    @classmethod
    def _location_url(cls, v: str | None) -> str | None:
        if v and not v.lower().startswith(("http://", "https://")):
            raise ValueError("the map link must start with http:// or https://")
        return v


class PropertyCreate(PropertyFields):
    owner_user_id: uuid.UUID | None = None  # managers may create a file for an advisor


class PropertyUpdate(PropertyFields):
    version: int = Field(ge=1)  # the version the client read; a mismatch gives 409


class StatusChange(BaseModel):
    status: Literal["active", "inactive", "closed"]
    deal_date: date | None = None


class ShareChange(BaseModel):
    shared: bool


class ReassignChange(BaseModel):
    owner_user_id: uuid.UUID


class PersonRef(BaseModel):
    id: uuid.UUID
    full_name: str


class CityRef(BaseModel):
    id: int
    name: str
    province_id: int
    province_name: str


class PropertyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    version: int
    status: str
    deal_type: str
    deal_date: date | None
    property_types: list[str]
    owner: PersonRef
    shared_with_agency: bool
    can_edit: bool
    is_favorite: bool

    city: CityRef
    district: str | None
    address: str | None
    location_url: str | None

    land_area_m2: AreaOut
    built_area_m2: AreaOut
    main_area_m2: AreaOut
    rooms: int | None
    floor: int | None
    total_floors: int | None
    total_units: int | None
    build_year: int | None
    direction: str | None
    is_corner: bool
    amenities: list[str]
    custom_amenities: list[str]

    document_type: str | None
    document_note: str | None
    ownership_dang: int
    occupancy: str | None
    vacate_date: date | None

    owner_name: str | None
    owner_phone: str | None

    price_total: int | None
    price_per_m2: int | None
    deposit: int | None
    monthly_rent: int | None
    convertible_options: list[dict[str, Any]]
    price_note: str | None
    sort_price: int | None

    contract_end_date: date | None
    delivery_date: date | None
    payment_terms: str | None

    is_urgent: bool
    urgent_until: date | None
    is_urgent_now: bool
    notes: str | None

    last_confirmed_at: datetime
    review_due_at: date | None
    created_at: datetime
    updated_at: datetime


class PropertyListOut(BaseModel):
    items: list[PropertyOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class HistoryOut(BaseModel):
    id: uuid.UUID
    user: PersonRef
    action: str
    changes: dict[str, Any]
    created_at: datetime


class SimilarOut(BaseModel):
    kind: Literal["phone", "address"]
    deal_type: str
    city_name: str
    advisor_name: str
    property_id: uuid.UUID | None  # only when the caller may see that file
    owner_name: str | None
    owner_phone: str | None


class StatsOut(BaseModel):
    total_active: int
    by_deal_type: dict[str, int]
    new_this_week: int
    urgent: int
    contracts_overdue: int
    contracts_ending_7_days: int
    contracts_ending_30_days: int

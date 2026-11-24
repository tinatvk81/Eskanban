from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import date
from typing import Protocol, TypeAlias

RawListing: TypeAlias = Mapping[str, object]


@dataclass(frozen=True, slots=True)
class NormalizedListing:
    """Source-independent listing data ready for persistence."""

    source: str
    external_id: str
    url: str
    title: str | None = None
    owner_name: str | None = None
    owner_phone: str | None = None
    address: str | None = None
    city_id: int | None = None
    district: str | None = None
    deal_type: str | None = None
    property_types: tuple[str, ...] = ()
    price_total: int | None = None
    deposit: int | None = None
    monthly_rent: int | None = None
    posted_at: date | None = None


class ListingConnector(Protocol):
    """Network-agnostic contract for source-specific listing connectors.

    Implementations yield raw records and never write to the database.
    """

    @property
    def source_key(self) -> str: ...

    def fetch_listings(self) -> Iterable[RawListing]: ...

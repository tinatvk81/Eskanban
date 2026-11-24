from __future__ import annotations

import re
from collections.abc import Mapping
from datetime import date, datetime

from app.ingest.contracts import NormalizedListing, RawListing

_SOURCE_KEY_RE = re.compile(r"^[a-z0-9_]{2,30}$")
_PERSIAN_DIGITS = str.maketrans(
    "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩",
    "01234567890123456789",
)
_BIGINT_MAX = 9_223_372_036_854_775_807
_INTEGER_MAX = 2_147_483_647

_TEXT_LIMITS = {
    "title": 255,
    "owner_name": 120,
    "owner_phone": 32,
    "address": 255,
    "district": 80,
    "deal_type": 20,
}


def _required_text(raw: Mapping[str, object], key: str, limit: int) -> str:
    value = raw.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} is required and must be a non-empty string")

    cleaned = value.strip()
    if len(cleaned) > limit:
        raise ValueError(f"{key} exceeds the {limit}-character limit")
    return cleaned


def _optional_text(
    raw: Mapping[str, object],
    key: str,
    limit: int,
) -> str | None:
    value = raw.get(key)
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(f"{key} must be a string or None")

    cleaned = value.strip()
    if not cleaned:
        return None
    if len(cleaned) > limit:
        raise ValueError(f"{key} exceeds the {limit}-character limit")
    return cleaned


def _optional_int(
    raw: Mapping[str, object],
    key: str,
    *,
    maximum: int = _BIGINT_MAX,
) -> int | None:
    value = raw.get(key)
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise ValueError(f"{key} must be a non-negative integer")

    if isinstance(value, int):
        number = value
    elif isinstance(value, str):
        normalized = value.translate(_PERSIAN_DIGITS)
        normalized = normalized.replace(",", "").replace("٬", "").replace(" ", "")
        if not normalized or not normalized.isascii() or not normalized.isdigit():
            raise ValueError(f"{key} must contain a non-negative integer")
        number = int(normalized)
    else:
        raise ValueError(f"{key} must be an integer, numeric string, or None")

    if number < 0:
        raise ValueError(f"{key} must not be negative")
    if number > maximum:
        raise ValueError(f"{key} exceeds the supported integer limit")
    return number


def _optional_date(raw: Mapping[str, object], key: str) -> date | None:
    value = raw.get(key)
    if value is None or value == "":
        return None

    # datetime subclasses date, so it must be rejected before isinstance(date).
    if isinstance(value, datetime):
        raise ValueError(f"{key} must be a date, not a datetime")
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value.strip())
        except ValueError as exc:
            raise ValueError(f"{key} must use YYYY-MM-DD format") from exc
    raise ValueError(f"{key} must be a date, ISO date string, or None")


def _property_types(raw: Mapping[str, object]) -> tuple[str, ...]:
    value = raw.get("property_types", ())
    if value is None:
        return ()
    if not isinstance(value, (list, tuple)):
        raise ValueError("property_types must be a list or tuple of strings")

    result: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise ValueError("property_types items must be strings")
        cleaned = item.strip()
        if cleaned and cleaned not in result:
            result.append(cleaned)
    return tuple(result)


def map_raw_listing(source: str, raw: RawListing) -> NormalizedListing:
    """Validate and normalize one source record without database or network I/O."""

    if not isinstance(source, str) or not _SOURCE_KEY_RE.fullmatch(source):
        raise ValueError("source must match ^[a-z0-9_]{2,30}$")

    external_id = _required_text(raw, "external_id", 120)
    url = _required_text(raw, "url", 500)
    city_id = _optional_int(raw, "city_id", maximum=_INTEGER_MAX)

    return NormalizedListing(
        source=source,
        external_id=external_id,
        url=url,
        title=_optional_text(raw, "title", _TEXT_LIMITS["title"]),
        owner_name=_optional_text(raw, "owner_name", _TEXT_LIMITS["owner_name"]),
        owner_phone=_optional_text(raw, "owner_phone", _TEXT_LIMITS["owner_phone"]),
        address=_optional_text(raw, "address", _TEXT_LIMITS["address"]),
        city_id=city_id,
        district=_optional_text(raw, "district", _TEXT_LIMITS["district"]),
        deal_type=_optional_text(raw, "deal_type", _TEXT_LIMITS["deal_type"]),
        property_types=_property_types(raw),
        price_total=_optional_int(raw, "price_total"),
        deposit=_optional_int(raw, "deposit"),
        monthly_rent=_optional_int(raw, "monthly_rent"),
        posted_at=_optional_date(raw, "posted_at"),
    )

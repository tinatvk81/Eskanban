import json
from datetime import date, datetime
from pathlib import Path

import pytest

from app.ingest.mapper import map_raw_listing

FIXTURES = Path(__file__).parent / "fixtures" / "ingestion"


def load_fixture(name: str) -> dict[str, object]:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def minimal_listing(**overrides: object) -> dict[str, object]:
    return {
        "external_id": "sample-1",
        "url": "https://example.invalid/ad/1",
        **overrides,
    }


def test_maps_offline_divar_fixture_to_normalized_listing() -> None:
    result = map_raw_listing("divar", load_fixture("divar_listing.json"))

    assert result.source == "divar"
    assert result.external_id == "divar-test-1001"
    assert result.title == "آپارتمان دو خوابه"
    assert result.owner_phone == "09120000000"
    assert result.property_types == ("apartment", "residential")
    assert result.price_total == 12_500_000_000
    assert result.posted_at == date(2026, 11, 20)
    assert result.deposit is None


def test_missing_optional_fields_are_allowed() -> None:
    result = map_raw_listing("sheypoor", minimal_listing())

    assert result.title is None
    assert result.owner_name is None
    assert result.property_types == ()
    assert result.price_total is None


@pytest.mark.parametrize("source", ["", "Divar", "a", "invalid-source", "x" * 31])
def test_rejects_invalid_source_key(source: str) -> None:
    with pytest.raises(ValueError, match="source"):
        map_raw_listing(source, minimal_listing())


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("external_id", ""),
        ("url", " "),
        ("price_total", "-100"),
        ("deposit", "not-a-number"),
        ("city_id", True),
        ("posted_at", "20-11-2026"),
        ("property_types", "apartment"),
        ("posted_at", datetime(2026, 11, 20, 12, 30)),
        ("title", "x" * 256),
        ("owner_name", "x" * 121),
        ("owner_phone", "1" * 33),
        ("address", "x" * 256),
        ("district", "x" * 81),
        ("deal_type", "x" * 21),
        ("external_id", "x" * 121),
        ("url", "https://example.invalid/" + "x" * 500),
        ("price_total", "9223372036854775808"),
        ("city_id", 2_147_483_648),
    ],
)
def test_rejects_invalid_field_values(field: str, value: object) -> None:
    with pytest.raises(ValueError):
        map_raw_listing("divar", minimal_listing(**{field: value}))


def test_accepts_ascii_and_persian_numeric_strings() -> None:
    result = map_raw_listing(
        "divar",
        minimal_listing(
            price_total="1,250,000",
            monthly_rent="۱۲۳۴۵۶",
            deposit="١٢٣٤٥",
        ),
    )

    assert result.price_total == 1_250_000
    assert result.monthly_rent == 123_456
    assert result.deposit == 12_345


def test_preserves_zero_values() -> None:
    result = map_raw_listing(
        "divar",
        minimal_listing(price_total=0, deposit="۰", monthly_rent=0, city_id=0),
    )

    assert result.price_total == 0
    assert result.deposit == 0
    assert result.monthly_rent == 0
    assert result.city_id == 0


def test_normalizes_optional_text_and_property_types() -> None:
    result = map_raw_listing(
        "divar",
        minimal_listing(
            title="  Apartment  ",
            owner_name=" ",
            property_types=[" apartment ", "apartment", "", "villa"],
        ),
    )

    assert result.title == "Apartment"
    assert result.owner_name is None
    assert result.property_types == ("apartment", "villa")


def test_accepts_date_object() -> None:
    result = map_raw_listing(
        "divar",
        minimal_listing(posted_at=date(2026, 11, 20)),
    )

    assert result.posted_at == date(2026, 11, 20)

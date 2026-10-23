import pytest
from pydantic import ValidationError

from app.schemas.properties import PropertyCreate, PropertyUpdate


def _base(**kw):
    return {"deal_type": "sale", "city_id": 1} | kw


def test_minimal_payload_is_valid_and_defaults_apply():
    p = PropertyCreate(**_base())
    assert p.ownership_dang == 6 and p.is_corner is False and p.amenities == []


@pytest.mark.parametrize(
    "bad",
    [
        {"deal_type": "barter"},
        {"property_types": ["apartment", "castle"]},
        {"amenities": ["elevator", "helipad"]},
        {"direction": "up"},
        {"occupancy": "squatters"},
        {"document_type": "napkin"},
        {"ownership_dang": 7},
        {"ownership_dang": 0},
        {"build_year": 1100},
        {"floor": 500},
        {"rooms": -1},
        {"price_total": -5},
        {"built_area_m2": -1},
        {"location_url": "javascript:alert(1)"},
        {"location_url": "maps.google.com/x"},
        {"notes": "x" * 2001},
    ],
)
def test_invalid_values_rejected(bad):
    with pytest.raises(ValidationError):
        PropertyCreate(**_base(**bad))


def test_lists_are_deduplicated_and_custom_amenities_trimmed():
    p = PropertyCreate(
        **_base(
            property_types=["villa", "villa"],
            amenities=["pool", "pool", "gym"],
            custom_amenities=[" سونا خشک ", "سونا خشک", ""],
        )
    )
    assert p.property_types == ["villa"]
    assert p.amenities == ["pool", "gym"]
    assert p.custom_amenities == ["سونا خشک"]


def test_big_prices_are_supported():
    assert PropertyCreate(**_base(price_total=25_000_000_000)).price_total == 25_000_000_000


def test_update_requires_a_version():
    with pytest.raises(ValidationError):
        PropertyUpdate(**_base())
    assert PropertyUpdate(**_base(version=3)).version == 3


def test_convertible_options_are_validated():
    ok = PropertyCreate(
        **_base(deal_type="rent", convertible_options=[{"deposit": 7, "monthly_rent": 3}])
    )
    assert ok.convertible_options[0].monthly_rent == 3
    with pytest.raises(ValidationError):
        PropertyCreate(**_base(convertible_options=[{"deposit": -1, "monthly_rent": 3}]))

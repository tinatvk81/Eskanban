import pytest

from app.core.errors import InvalidInput
from app.core.phone import normalize_phone


@pytest.mark.parametrize(
    "raw",
    [
        "09121234567",
        "9121234567",
        "989121234567",
        "+989121234567",
        "00989121234567",
        "+98 912 123 4567",
        "0912-123-4567",
        "۰۹۱۲۱۲۳۴۵۶۷",  # Persian digits
        "٠٩١٢١٢٣٤٥٦٧",  # Arabic-Indic digits
    ],
)
def test_iranian_mobile_formats_normalise(raw):
    assert normalize_phone(raw) == "+989121234567"


def test_international_mobile_accepted():
    assert normalize_phone("+14155552671") == "+14155552671"


@pytest.mark.parametrize(
    "raw", ["", "abc", "0912123", "02112345678", "+98", "12345678901234567890"]
)
def test_invalid_or_landline_rejected(raw):
    with pytest.raises(InvalidInput):
        normalize_phone(raw)

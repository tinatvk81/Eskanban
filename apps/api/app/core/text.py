"""Persian-aware text normalisation, used for searching and duplicate detection."""

import re

_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
_SPACES = re.compile(r"\s+")


def normalize_text(value: str | None) -> str:
    """Lower-case, ASCII digits, Persian ی/ک, ZWNJ -> space, collapsed whitespace."""
    text = (value or "").translate(_DIGITS)
    text = text.replace("ي", "ی").replace("ك", "ک").replace("\u200c", " ")
    return _SPACES.sub(" ", text).strip().lower()

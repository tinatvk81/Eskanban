import re

import phonenumbers
from phonenumbers import NumberParseException, PhoneNumberFormat, PhoneNumberType

from app.core.errors import InvalidInput

# Persian (۰-۹) and Arabic-Indic (٠-٩) digits -> ASCII
_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
_MOBILE_TYPES = {PhoneNumberType.MOBILE, PhoneNumberType.FIXED_LINE_OR_MOBILE}


def normalize_phone(raw: str, default_region: str = "IR") -> str:
    """Return the canonical E.164 form (e.g. ``+989121234567``) of a mobile number.

    Accepts ``0912...``, ``912...``, ``98912...``, ``+98912...``, ``0098912...`` and Persian digits.
    Landline numbers are rejected: the number is used to log in and to receive SMS codes.
    """
    text = raw.strip().translate(_DIGITS)
    text = re.sub(r"[\s\-().]", "", text)
    if text.startswith("00"):
        text = "+" + text[2:]
    try:
        number = phonenumbers.parse(text, default_region)
    except NumberParseException as exc:
        raise InvalidInput("invalid mobile number") from exc
    if not phonenumbers.is_valid_number(number):
        raise InvalidInput("invalid mobile number")
    if phonenumbers.number_type(number) not in _MOBILE_TYPES:
        raise InvalidInput("a mobile number is required")
    return phonenumbers.format_number(number, PhoneNumberFormat.E164)

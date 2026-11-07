"""Controlled vocabularies for property files (ADR-0011).

The keys are stored in the database (enforced by CHECK constraints); labels are for display only.
Add a value by editing this file AND adding a migration that updates the matching CHECK constraint.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Item:
    key: str
    fa: str
    en: str


def _items(*rows: tuple[str, str, str]) -> tuple[Item, ...]:
    return tuple(Item(*row) for row in rows)


DEAL_TYPES = _items(
    ("sale", "فروش", "Sale"),
    ("presale", "پیش‌خرید", "Pre-sale"),
    ("rent", "اجاره", "Rent"),
    ("mortgage", "رهن کامل", "Full mortgage"),
)

STATUSES = _items(
    ("active", "فعال", "Active"),
    ("inactive", "غیرفعال", "Inactive"),
    ("closed", "قطعی‌شده", "Closed"),
)

# Same keys the legacy app used, so existing data maps one to one.
PROPERTY_TYPES = _items(
    ("apartment", "آپارتمان", "Apartment"),
    ("villa", "ویلایی", "House / villa"),
    ("old_house", "خانهٔ قدیمی", "Old house"),
    ("land", "زمین", "Land"),
    ("demolishable", "کلنگی", "Teardown"),
    ("commercial_office", "تجاری/اداری", "Commercial / office"),
    ("shop", "مغازه", "Shop"),
    ("office", "دفتر کار", "Office"),
    ("workshop", "سوله/انبار/کارگاه", "Warehouse / workshop"),
    ("educational", "آموزشی", "Educational"),
    ("garden", "باغ/باغچه", "Garden"),
    ("industrial", "صنعتی", "Industrial"),
    ("other", "سایر", "Other"),
)

AMENITIES = _items(
    ("elevator", "آسانسور", "Elevator"),
    ("parking", "پارکینگ", "Parking"),
    ("storage", "انباری", "Storage room"),
    ("balcony", "بالکن", "Balcony"),
    ("yard", "حیاط", "Yard"),
    ("roof_garden", "روف گاردن", "Roof garden"),
    ("pool", "استخر", "Pool"),
    ("sauna", "سونا", "Sauna"),
    ("jacuzzi", "جکوزی", "Jacuzzi"),
    ("gym", "سالن ورزش", "Gym"),
    ("lobby", "لابی", "Lobby"),
    ("security", "نگهبانی", "Security"),
    ("caretaker", "منزل سرایدار", "Caretaker's flat"),
    ("package_heating", "پکیج", "Package boiler"),
    ("radiator", "رادیاتور", "Radiators"),
    ("split_ac", "کولر گازی", "Split AC"),
    ("evaporative_cooler", "کولر آبی", "Evaporative cooler"),
    ("fan_coil", "فن کویل", "Fan coil"),
    ("chiller", "چیلر", "Chiller"),
    ("built_in_wardrobe", "کمد دیواری", "Built-in wardrobes"),
    ("anti_theft_door", "درب ضدسرقت", "Security door"),
    ("double_glazed", "پنجره دوجداره", "Double glazing"),
    ("master_bath", "حمام مستر", "Master bathroom"),
    ("open_kitchen", "آشپزخانه اپن", "Open kitchen"),
    ("renovated", "بازسازی‌شده", "Renovated"),
    ("new_build", "نوساز", "Newly built"),
    ("unused", "کلید نخورده", "Never lived in"),
)

DIRECTIONS = _items(
    ("north", "شمالی", "North"),
    ("south", "جنوبی", "South"),
    ("east", "شرقی", "East"),
    ("west", "غربی", "West"),
)

OCCUPANCY = _items(
    ("vacant", "خالی", "Vacant"),
    ("owner_occupied", "مالک ساکن", "Owner lives there"),
    ("tenant_occupied", "مستاجر دارد", "Tenant lives there"),
)

DOCUMENT_TYPES = _items(
    ("official", "سند رسمی", "Official deed"),
    ("tak_barg", "سند تک‌برگ", "Single-sheet deed"),
    ("mangoole_dar", "سند منگوله‌دار (دفترچه‌ای)", "Booklet deed"),
    ("informal", "سند عادی / قولنامه‌ای", "Informal document (contract only)"),
    ("other", "سایر", "Other"),
)

# What the deed covers: land and building, or only one of them.
DEED_SCOPES = _items(
    ("land_and_building", "عرصه و اعیان", "Land and building"),
    ("land_only", "فقط عرصه", "Land only"),
    ("building_only", "فقط اعیان", "Building only"),
)

# Legal kind of ownership: free (tolq) or endowment (waqf).
OWNERSHIP_KINDS = _items(
    ("freehold", "طلق (آزاد)", "Freehold"),
    ("waqf", "وقفی", "Endowment (waqf)"),
)

SORT_FIELDS = ("created_at", "updated_at", "price", "area", "contract_end_date")


def keys(items: tuple[Item, ...]) -> tuple[str, ...]:
    return tuple(i.key for i in items)


def sql_list(items: tuple[Item, ...]) -> str:
    """'a', 'b', 'c' — for CHECK constraints."""
    return ", ".join(f"'{k}'" for k in keys(items))


ALL = {
    "deal_types": DEAL_TYPES,
    "statuses": STATUSES,
    "property_types": PROPERTY_TYPES,
    "amenities": AMENITIES,
    "directions": DIRECTIONS,
    "occupancy": OCCUPANCY,
    "document_types": DOCUMENT_TYPES,
    "deed_scopes": DEED_SCOPES,
    "ownership_kinds": OWNERSHIP_KINDS,
}

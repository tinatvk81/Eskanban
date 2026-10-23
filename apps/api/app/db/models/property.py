import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.mixins import IdMixin, TenantMixin, TimestampMixin
from app.domain import vocab


def _array_check(column: str, items: tuple[vocab.Item, ...]) -> str:
    return f"{column} <@ ARRAY[{vocab.sql_list(items)}]::varchar[]"


class Property(IdMixin, TimestampMixin, TenantMixin, Base):
    """A property file (ADR-0011). Prices are whole Toman."""

    __tablename__ = "properties"

    # --- optimistic locking: bumped by SQLAlchemy on every UPDATE ---
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    __mapper_args__ = {"version_id_col": version}

    # --- ownership and visibility ---
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    shared_with_agency: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )

    # --- classification ---
    deal_type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="active")
    deal_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # when the deal was closed
    property_types: Mapped[list[str]] = mapped_column(
        ARRAY(String(30)), nullable=False, server_default=text("'{}'")
    )

    # --- location ---
    city_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("cities.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    district: Mapped[str | None] = mapped_column(String(80), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # --- physical ---
    land_area_m2: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)  # عرصه
    built_area_m2: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)  # زیربنا
    main_area_m2: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), Computed("coalesce(built_area_m2, land_area_m2)", persisted=True)
    )
    rooms: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    floor: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True
    )  # 0 = ground, <0 = basement
    total_floors: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    total_units: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    build_year: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)  # Jalali year
    direction: Mapped[str | None] = mapped_column(String(10), nullable=True)
    is_corner: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    amenities: Mapped[list[str]] = mapped_column(
        ARRAY(String(30)), nullable=False, server_default=text("'{}'")
    )
    custom_amenities: Mapped[list[str]] = mapped_column(
        ARRAY(String(60)), nullable=False, server_default=text("'{}'")
    )

    # --- legal ---
    document_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    document_note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    ownership_dang: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="6")

    # --- occupancy ---
    occupancy: Mapped[str | None] = mapped_column(String(20), nullable=True)
    vacate_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # --- owner contact ---
    owner_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    owner_phone: Mapped[str | None] = mapped_column(String(16), nullable=True)

    # --- prices (whole Toman) ---
    price_total: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # sale / presale
    price_per_m2: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    deposit: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True
    )  # rent deposit / mortgage
    monthly_rent: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    convertible_options: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )  # [{"deposit": 700000000, "monthly_rent": 30000000}, ...]
    price_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_price: Mapped[int | None] = mapped_column(
        BigInteger,
        Computed(
            "CASE WHEN deal_type = 'rent' THEN monthly_rent "
            "ELSE coalesce(price_total, deposit) END",
            persisted=True,
        ),
    )

    # --- deal-specific dates and terms ---
    contract_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # rent / mortgage
    delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # presale
    payment_terms: Mapped[str | None] = mapped_column(String(1000), nullable=True)  # presale

    # --- urgency ---
    is_urgent: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    urgent_until: Mapped[date | None] = mapped_column(Date, nullable=True)

    # --- free text and search ---
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    search_text: Mapped[str] = mapped_column(Text, nullable=False, server_default="")

    # --- periodic review (the expiry workflow itself arrives later) ---
    last_confirmed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    review_due_at: Mapped[date | None] = mapped_column(Date, nullable=True)

    # --- soft delete (manager only; hidden everywhere, kept for support) ---
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            f"deal_type IN ({vocab.sql_list(vocab.DEAL_TYPES)})", name="deal_type_valid"
        ),
        CheckConstraint(f"status IN ({vocab.sql_list(vocab.STATUSES)})", name="status_valid"),
        CheckConstraint(
            _array_check("property_types", vocab.PROPERTY_TYPES), name="property_types_valid"
        ),
        CheckConstraint(_array_check("amenities", vocab.AMENITIES), name="amenities_valid"),
        CheckConstraint(
            f"direction IS NULL OR direction IN ({vocab.sql_list(vocab.DIRECTIONS)})",
            name="direction_valid",
        ),
        CheckConstraint(
            f"occupancy IS NULL OR occupancy IN ({vocab.sql_list(vocab.OCCUPANCY)})",
            name="occupancy_valid",
        ),
        CheckConstraint(
            f"document_type IS NULL OR document_type IN ({vocab.sql_list(vocab.DOCUMENT_TYPES)})",
            name="document_type_valid",
        ),
        CheckConstraint("ownership_dang BETWEEN 1 AND 6", name="dang_valid"),
        CheckConstraint(
            "build_year IS NULL OR build_year BETWEEN 1200 AND 1600", name="build_year_valid"
        ),
        CheckConstraint("floor IS NULL OR floor BETWEEN -10 AND 200", name="floor_valid"),
        CheckConstraint(
            "coalesce(land_area_m2, 0) >= 0 AND coalesce(built_area_m2, 0) >= 0",
            name="areas_non_negative",
        ),
        CheckConstraint(
            "coalesce(price_total, 0) >= 0 AND coalesce(price_per_m2, 0) >= 0 "
            "AND coalesce(deposit, 0) >= 0 AND coalesce(monthly_rent, 0) >= 0",
            name="prices_non_negative",
        ),
        Index("ix_properties_agency_status", "agency_id", "status"),
        Index("ix_properties_contract_end_date", "contract_end_date"),
        Index("ix_properties_property_types_gin", "property_types", postgresql_using="gin"),
        Index("ix_properties_amenities_gin", "amenities", postgresql_using="gin"),
    )


class PropertyFavorite(TenantMixin, Base):
    """A user's personal star on a file."""

    __tablename__ = "property_favorites"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("properties.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class PropertyHistory(IdMixin, TenantMixin, Base):
    """Append-only change log of a file (the old app's «activity history»)."""

    __tablename__ = "property_history"
    __table_args__ = (Index("ix_property_history_property_created", "property_id", "created_at"),)

    property_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("properties.id", ondelete="RESTRICT"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    action: Mapped[str] = mapped_column(String(30), nullable=False)
    changes: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

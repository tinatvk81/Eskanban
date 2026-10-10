import enum

from sqlalchemy import Boolean, CheckConstraint, Enum, Integer, String, true
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.mixins import IdMixin, TimestampMixin


class Plan(enum.StrEnum):
    SOLO = "solo"  # 1 seat
    SMALL = "small"  # 2-5 seats
    LARGE = "large"  # 6+ seats, per-seat pricing


class Agency(IdMixin, TimestampMixin, Base):
    """A real estate agency = one tenant."""

    __tablename__ = "agencies"
    __table_args__ = (
        CheckConstraint("seat_limit >= 1", name="seat_limit_positive"),
        CheckConstraint("plan IN ('solo', 'small', 'large')", name="plan_valid"),
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    plan: Mapped[Plan] = mapped_column(
        Enum(
            Plan,
            name="plan",
            native_enum=False,
            length=20,
            create_constraint=False,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=Plan.SOLO,
    )
    seat_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=true())

import enum
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, Index, Integer, String, text, true
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.mixins import IdMixin, TenantMixin, TimestampMixin


class Role(enum.StrEnum):
    MANAGER = "manager"  # full agency access, reports
    ADVISOR = "advisor"  # own workspace only


class User(IdMixin, TimestampMixin, TenantMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        # Optional email, unique platform-wide (case-insensitive) when present.
        Index("uq_users_email_lower", text("lower(email)"), unique=True),
        CheckConstraint("role IN ('manager', 'advisor')", name="role_valid"),
        CheckConstraint("failed_login_attempts >= 0", name="failed_attempts_non_negative"),
    )

    # Login identifier: normalised E.164 mobile number, unique platform-wide.
    phone: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[Role] = mapped_column(
        Enum(
            Role,
            name="role",
            native_enum=False,
            length=20,
            create_constraint=False,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=true())

    # Authentication state
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    failed_login_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

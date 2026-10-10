import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Uuid, func
from sqlalchemy.orm import Mapped, declared_attr, mapped_column


class IdMixin:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class TenantMixin:
    """Marks a table as owned by exactly one agency (ADR-0005, ADR-0008).

    Every model with this mixin is automatically filtered and guarded by the tenant
    session scope (see app/db/tenancy.py). New tenant-owned tables MUST use it.
    """

    @declared_attr
    def agency_id(cls) -> Mapped[uuid.UUID]:
        return mapped_column(
            ForeignKey("agencies.id", ondelete="RESTRICT"), nullable=False, index=True
        )

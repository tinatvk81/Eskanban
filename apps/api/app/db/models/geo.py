from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Province(Base):
    """Reference data shared by all agencies (not tenant-owned)."""

    __tablename__ = "provinces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)


class City(Base):
    __tablename__ = "cities"
    __table_args__ = (UniqueConstraint("province_id", "name", name="uq_cities_province_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    province_id: Mapped[int] = mapped_column(
        ForeignKey("provinces.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    name_normalized: Mapped[str] = mapped_column(String(80), nullable=False, index=True)

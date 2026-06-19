"""ORM models."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="analyst")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SolarReading(Base):
    """A point-in-time snapshot of space-weather conditions."""

    __tablename__ = "solar_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
    kp_index: Mapped[float] = mapped_column(Float)
    solar_wind_speed: Mapped[float] = mapped_column(Float)
    proton_density: Mapped[float] = mapped_column(Float)
    bz: Mapped[float] = mapped_column(Float)
    xray_flux: Mapped[float] = mapped_column(Float)
    sunspot_number: Mapped[int] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(32), default="synthetic")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
    level: Mapped[str] = mapped_column(String(16))  # info|watch|warning|severe
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(64), default="HelioWatch")
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    # Dedup key so the scheduler does not spam identical alerts.
    dedup_key: Mapped[str] = mapped_column(String(128), index=True, default="")

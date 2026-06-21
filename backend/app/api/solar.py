"""Live + historical space-weather data."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import SolarReading
from ..schemas import SolarHistoryPoint, SolarNow, SolarStatus
from .. import solar_engine as se
from ..config import settings

router = APIRouter(prefix="/solar", tags=["solar"])


@router.get("/now", response_model=SolarNow)
async def solar_now() -> SolarNow:
    """Current space-weather conditions — live NOAA data if available."""
    reading = await se.fetch_live()
    payload = se.reading_to_now(reading)
    return SolarNow.model_validate(payload)


@router.get("/history", response_model=list[SolarHistoryPoint])
async def solar_history(
    hours: int = Query(48, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
) -> list[SolarHistoryPoint]:
    """
    Returns up to `hours` of historical readings from the DB.
    Auto-backfills with synthetic data if the DB is sparse (fresh clone).
    """
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    rows = (
        (
            await db.execute(
                select(SolarReading)
                .where(SolarReading.timestamp >= since)
                .order_by(SolarReading.timestamp.asc())
            )
        )
        .scalars()
        .all()
    )

    if rows:
        return [
            SolarHistoryPoint(
                timestamp=r.timestamp,
                kp_index=r.kp_index,
                solar_wind_speed=r.solar_wind_speed,
                proton_density=r.proton_density,
                bz=r.bz,
                xray_flux=r.xray_flux,
                sunspot_number=r.sunspot_number,
                source=r.source,
            )
            for r in rows
        ]

    # Backfill: synthesize ~96 evenly-spaced points so charts are never empty.
    now = datetime.now(timezone.utc)
    step = max(1, hours // 96)
    points = []
    for i in range(hours, -1, -step):
        ts = now - timedelta(hours=i)
        r  = se.synthesize(ts)
        points.append(
            SolarHistoryPoint(
                timestamp=ts,
                kp_index=r.kp_index,
                solar_wind_speed=r.solar_wind_speed,
                proton_density=r.proton_density,
                bz=r.bz,
                xray_flux=r.xray_flux,
                sunspot_number=r.sunspot_number,
                source="synthetic",
            )
        )
    return points


@router.get("/status", response_model=SolarStatus)
async def solar_status() -> SolarStatus:
    """Health status of the live NOAA data pipeline and cache."""
    info = se.live_status()
    return SolarStatus(
        source=info["source"],
        cache_age_seconds=info["cache_age_seconds"],
        consecutive_failures=info["consecutive_failures"],
        last_error=info["last_error"],
        last_kp=info["last_kp"],
        last_xray_class=info["last_xray_class"],
        use_live_upstream=settings.use_live_upstream,
        noaa_feeds=info["noaa_feeds"],
    )

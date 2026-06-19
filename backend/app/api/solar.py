"""Live + historical space-weather data."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import SolarReading
from ..schemas import SolarHistoryPoint, SolarNow
from .. import solar_engine as se

router = APIRouter(prefix="/solar", tags=["solar"])


@router.get("/now", response_model=SolarNow)
async def solar_now() -> SolarNow:
    return SolarNow.model_validate(se.reading_to_now(se.current()))


@router.get("/history", response_model=list[SolarHistoryPoint])
async def solar_history(
    hours: int = Query(48, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
) -> list[SolarHistoryPoint]:
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

    # If the scheduler has not populated enough history yet, synthesize a smooth
    # backfill so charts are never empty (great for a fresh hackathon clone).
    if len(rows) < hours:
        points = []
        now = datetime.now(timezone.utc)
        step = max(1, hours // 96)  # ~96 points max
        for i in range(hours, -1, -step):
            ts = now - timedelta(hours=i)
            r = se.synthesize(ts)
            points.append(
                SolarHistoryPoint(
                    timestamp=ts,
                    kp_index=r.kp_index,
                    solar_wind_speed=r.solar_wind_speed,
                    xray_flux=r.xray_flux,
                    sunspot_number=r.sunspot_number,
                )
            )
        return points

    return [
        SolarHistoryPoint(
            timestamp=r.timestamp,
            kp_index=r.kp_index,
            solar_wind_speed=r.solar_wind_speed,
            xray_flux=r.xray_flux,
            sunspot_number=r.sunspot_number,
        )
        for r in rows
    ]

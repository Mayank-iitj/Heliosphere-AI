"""
Background ingestion scheduler.

Every `INGEST_INTERVAL_SECONDS` it records a fresh solar reading and evaluates
alert thresholds, raising deduplicated tiered alerts. Runs as an asyncio task
(no external scheduler dependency) started/stopped via the app lifespan.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging

from sqlalchemy import select

from ..config import settings
from ..db import SessionLocal
from ..models import Alert, SolarReading
from .. import solar_engine as se

log = logging.getLogger("helio.scheduler")


async def _record_reading() -> se.RawReading:
    r = se.current()
    async with SessionLocal() as db:
        db.add(
            SolarReading(
                timestamp=r.timestamp,
                kp_index=r.kp_index,
                solar_wind_speed=r.solar_wind_speed,
                proton_density=r.proton_density,
                bz=r.bz,
                xray_flux=r.xray_flux,
                sunspot_number=r.sunspot_number,
                source=r.source,
            )
        )
        await db.commit()
    return r


def _evaluate_alerts(r: se.RawReading) -> list[dict]:
    """Return alert dicts that current conditions warrant."""
    out: list[dict] = []
    cls = se.xray_class(r.xray_flux)

    if r.xray_flux >= 1e-4:
        out.append(
            {
                "level": "severe",
                "title": f"X-class flare in progress ({cls})",
                "body": "Strong solar flare detected. R3+ radio blackout possible on the "
                "sunlit side. HF comms and GNSS may degrade.",
                "dedup_key": f"xflare-{r.timestamp:%Y%m%d%H}",
            }
        )
    elif r.xray_flux >= 1e-5:
        out.append(
            {
                "level": "warning",
                "title": f"M-class flare activity ({cls})",
                "body": "Moderate flare flux detected. Minor radio blackouts possible at "
                "high frequencies.",
                "dedup_key": f"mflare-{r.timestamp:%Y%m%d%H}",
            }
        )

    if r.kp_index >= 6:
        out.append(
            {
                "level": "severe",
                "title": f"Geomagnetic storm — Kp {r.kp_index:.0f}",
                "body": "Strong geomagnetic storm conditions. Satellite drag and surface "
                "charging risk elevated; aurora visible at mid-latitudes.",
                "dedup_key": f"gstorm-{r.timestamp:%Y%m%d%H}",
            }
        )
    elif r.kp_index >= 5:
        out.append(
            {
                "level": "warning",
                "title": f"Minor geomagnetic storm — Kp {r.kp_index:.0f}",
                "body": "G1 storm conditions reached. Weak power-grid fluctuations and "
                "aurora at high latitudes possible.",
                "dedup_key": f"g1storm-{r.timestamp:%Y%m%d%H}",
            }
        )

    if r.bz <= -10:
        out.append(
            {
                "level": "watch",
                "title": f"Strong southward Bz ({r.bz:.0f} nT)",
                "body": "Sustained southward IMF favours geomagnetic coupling — storm "
                "watch in effect.",
                "dedup_key": f"bz-{r.timestamp:%Y%m%d%H}",
            }
        )
    return out


async def _raise_alerts(alerts: list[dict]) -> None:
    if not alerts:
        return
    async with SessionLocal() as db:
        for a in alerts:
            exists = (
                await db.execute(
                    select(Alert.id).where(Alert.dedup_key == a["dedup_key"])
                )
            ).first()
            if exists:
                continue
            db.add(
                Alert(
                    level=a["level"],
                    title=a["title"],
                    body=a["body"],
                    source="HelioWatch",
                    dedup_key=a["dedup_key"],
                )
            )
            log.info("ALERT [%s] %s", a["level"].upper(), a["title"])
        await db.commit()


async def _loop() -> None:
    log.info("Ingestion scheduler started (every %ss)", settings.ingest_interval_seconds)
    while True:
        try:
            r = await _record_reading()
            await _raise_alerts(_evaluate_alerts(r))
        except Exception:  # keep the loop alive no matter what
            log.exception("scheduler tick failed")
        await asyncio.sleep(settings.ingest_interval_seconds)


def start(app) -> None:
    if not settings.scheduler_enabled:
        log.info("Scheduler disabled by config")
        return
    app.state.scheduler_task = asyncio.create_task(_loop())


async def stop(app) -> None:
    task = getattr(app.state, "scheduler_task", None)
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task

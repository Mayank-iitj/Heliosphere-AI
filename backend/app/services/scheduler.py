"""
Background ingestion scheduler — real NOAA live data + alert engine.

Every `INGEST_INTERVAL_SECONDS` it:
  1. Fetches live NOAA data (or synthetic fallback)
  2. Persists the reading to the DB
  3. Evaluates tiered alert thresholds (deduped per 6-hour window)
  4. Backs off exponentially on consecutive NOAA failures

Runs as an asyncio task, started/stopped via app lifespan.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import time

from sqlalchemy import select

from ..config import settings
from ..db import SessionLocal
from ..models import Alert, SolarReading
from .. import solar_engine as se

log = logging.getLogger("helio.scheduler")

# Exponential backoff: base interval × 2^n, capped at 5 min
_MAX_BACKOFF_S = 300


async def _record_reading() -> se.RawReading:
    """Fetch live reading and persist to DB."""
    reading = await se.fetch_live()
    async with SessionLocal() as db:
        db.add(
            SolarReading(
                timestamp=reading.timestamp,
                kp_index=reading.kp_index,
                solar_wind_speed=reading.solar_wind_speed,
                proton_density=reading.proton_density,
                bz=reading.bz,
                xray_flux=reading.xray_flux,
                sunspot_number=reading.sunspot_number,
                source=reading.source,
            )
        )
        await db.commit()
    return reading


def _evaluate_alerts(r: se.RawReading) -> list[dict]:
    """Return alert dicts for current conditions. Dedup key is per-6-hour window."""
    out: list[dict] = []
    cls = se.xray_class(r.xray_flux)
    # 6-hour window key: YYYYMMDDHH // 6 * 6
    from datetime import timezone
    ts = r.timestamp
    hour6 = (ts.hour // 6) * 6
    window = f"{ts:%Y%m%d}{hour6:02d}"

    # --- X-ray flare alerts ---
    if r.xray_flux >= 1e-4:
        out.append({
            "level": "severe",
            "title": f"X-class solar flare in progress ({cls})",
            "body": (
                f"Strong X-class flare detected: {cls} ({r.xray_flux:.2e} W/m²). "
                "R3+ radio blackout possible on sunlit side. HF communications and "
                "GNSS precision may degrade significantly. Aditya-L1 SoLEXS/HEL1OS "
                "detectors approaching saturation — data integrity review required."
            ),
            "dedup_key": f"xflare-{window}",
        })
    elif r.xray_flux >= 1e-5:
        out.append({
            "level": "warning",
            "title": f"M-class flare activity ({cls})",
            "body": (
                f"Moderate M-class flare flux detected: {cls} ({r.xray_flux:.2e} W/m²). "
                "Minor radio blackouts possible at high frequencies. "
                "Aditya-L1 SoLEXS in elevated monitoring mode."
            ),
            "dedup_key": f"mflare-{window}",
        })
    elif r.xray_flux >= 1e-6:
        out.append({
            "level": "info",
            "title": f"C-class flare background ({cls})",
            "body": (
                f"Low-level C-class flux detected: {cls}. No operational impact expected. "
                "SoLEXS nominal. Monitor for escalation."
            ),
            "dedup_key": f"cflare-{window}",
        })

    # --- Geomagnetic storm alerts ---
    if r.kp_index >= 7:
        out.append({
            "level": "severe",
            "title": f"Severe geomagnetic storm — Kp {r.kp_index:.0f} (G3+)",
            "body": (
                f"Kp index reached {r.kp_index:.1f}. G3+ storm conditions active. "
                "Satellite drag and surface charging elevated. Aurora visible at mid-latitudes. "
                "Aditya-L1 attitude control loads may increase. HF communications degraded."
            ),
            "dedup_key": f"gstorm-{window}",
        })
    elif r.kp_index >= 5:
        out.append({
            "level": "warning",
            "title": f"Geomagnetic storm — Kp {r.kp_index:.0f} (G1–G2)",
            "body": (
                f"G1/G2 storm conditions reached (Kp {r.kp_index:.1f}). "
                "Weak power-grid fluctuations possible. Aurora at high latitudes. "
                "Aditya-L1 MAG instrument in enhanced sampling mode."
            ),
            "dedup_key": f"g1storm-{window}",
        })
    elif r.kp_index >= 4:
        out.append({
            "level": "watch",
            "title": f"Active geomagnetic conditions — Kp {r.kp_index:.0f}",
            "body": (
                f"Kp {r.kp_index:.1f} — active but below storm threshold. "
                "Watch for further intensification. Solar wind coupling is elevated."
            ),
            "dedup_key": f"kpactive-{window}",
        })

    # --- Southward Bz alerts ---
    if r.bz <= -15:
        out.append({
            "level": "warning",
            "title": f"Strong southward Bz ({r.bz:.0f} nT) — storm driver",
            "body": (
                f"IMF Bz sustained at {r.bz:.1f} nT (southward). "
                "Strong geomagnetic coupling in effect — storm development likely. "
                "Aditya-L1 MAG at enhanced sampling rate."
            ),
            "dedup_key": f"bz-strong-{window}",
        })
    elif r.bz <= -8:
        out.append({
            "level": "watch",
            "title": f"Southward Bz ({r.bz:.0f} nT) — geomagnetic watch",
            "body": (
                f"IMF Bz at {r.bz:.1f} nT (southward). Sustained negative Bz drives "
                "magnetospheric energy input — storm watch in effect. "
                "Solar wind speed: {r.solar_wind_speed:.0f} km/s."
            ).replace("{r.solar_wind_speed:.0f}", str(int(r.solar_wind_speed))),
            "dedup_key": f"bz-watch-{window}",
        })

    # --- Solar wind speed ---
    if r.solar_wind_speed > 700:
        out.append({
            "level": "warning",
            "title": f"High-speed solar wind stream ({r.solar_wind_speed:.0f} km/s)",
            "body": (
                f"Solar wind speed: {r.solar_wind_speed:.0f} km/s — high-speed stream (HSS) conditions. "
                "Proton density: {r.proton_density:.1f} p/cm³. "
                "ASPEX/PAPA high-rate mode recommended. Geomagnetic enhancement possible."
            ).replace("{r.proton_density:.1f}", str(round(r.proton_density, 1))),
            "dedup_key": f"hss-{window}",
        })
    elif r.solar_wind_speed > 550:
        out.append({
            "level": "watch",
            "title": f"Elevated solar wind speed ({r.solar_wind_speed:.0f} km/s)",
            "body": (
                f"Solar wind at {r.solar_wind_speed:.0f} km/s — above nominal. "
                "Monitor for geomagnetic activity if Bz turns southward."
            ),
            "dedup_key": f"wind-elevated-{window}",
        })

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
                    source="HelioWatch Autonomous",
                    dedup_key=a["dedup_key"],
                )
            )
            log.info("ALERT [%s] %s", a["level"].upper(), a["title"])
        await db.commit()


async def _loop() -> None:
    log.info(
        "Ingestion scheduler started — interval %ds, live upstream: %s",
        settings.ingest_interval_seconds,
        settings.use_live_upstream,
    )
    consecutive_errors = 0
    while True:
        try:
            r = await _record_reading()
            await _raise_alerts(_evaluate_alerts(r))
            consecutive_errors = 0
            interval = settings.ingest_interval_seconds
        except Exception:
            log.exception("Scheduler tick failed")
            consecutive_errors += 1
            # Exponential backoff: 60, 120, 240, 300, 300, …
            interval = min(
                settings.ingest_interval_seconds * (2 ** consecutive_errors),
                _MAX_BACKOFF_S,
            )
            log.warning("Backing off — next tick in %ds (failure #%d)", interval, consecutive_errors)

        await asyncio.sleep(interval)


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

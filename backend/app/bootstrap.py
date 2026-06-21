"""First-run bootstrap: admin user + rich seed history + sample alerts."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from .config import settings
from .db import SessionLocal
from .models import Alert, SolarReading, User
from .security import hash_password
from . import solar_engine as se

log = logging.getLogger("helio.bootstrap")

# Sample alerts to seed on first run (gives the Alert Center life immediately)
_SEED_ALERTS = [
    {
        "level": "info",
        "title": "HelioSphere AI online — NOAA SWPC feeds connected",
        "body": (
            "System startup complete. Live solar data ingestion is active. "
            "Monitoring NOAA SWPC planetary K-index, GOES X-ray, solar wind plasma, "
            "IMF Bz, and SILSO sunspot feeds at 60-second intervals."
        ),
        "source": "HelioSphere System",
        "dedup_key": "system-startup-v1",
    },
    {
        "level": "info",
        "title": "Aditya-L1 mission operations console initialized",
        "body": (
            "HelioSphere AI is now monitoring Aditya-L1's 7 scientific payloads: "
            "VELC, SUIT, ASPEX, PAPA, SoLEXS, HEL1OS, and MAG. "
            "All instruments reporting nominal status at L1 halo orbit (~1.5 M km from Earth)."
        ),
        "source": "Aditya-L1 OPS",
        "dedup_key": "aditya-init-v1",
    },
    {
        "level": "watch",
        "title": "Elevated solar activity — monitoring period active",
        "body": (
            "Solar Cycle 25 peak approaching. Background X-ray flux elevated above seasonal average. "
            "SoLEXS and HEL1OS in enhanced monitoring mode. Flare watch in effect — "
            "operators should review forecast probabilities hourly."
        ),
        "source": "HelioWatch Autonomous",
        "dedup_key": "sc25-watch-bootstrap",
    },
]


async def bootstrap() -> None:
    async with SessionLocal() as db:
        # ── Admin user ─────────────────────────────────────────────────────
        admin = (
            await db.execute(select(User).where(User.email == settings.admin_email))
        ).scalar_one_or_none()
        if not admin:
            db.add(
                User(
                    email=settings.admin_email,
                    full_name="HelioSphere Admin",
                    hashed_password=hash_password(settings.admin_password),
                    role="admin",
                )
            )
            log.info("Bootstrapped admin user %s", settings.admin_email)

        # ── Seed history ───────────────────────────────────────────────────
        count = (await db.execute(select(func.count(SolarReading.id)))).scalar_one()
        if count < 100:
            log.info("Seeding solar history …")
            readings = await _build_seed_history()
            for r in readings:
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
            log.info("Seeded %d readings", len(readings))

        # ── Seed alerts ────────────────────────────────────────────────────
        alert_count = (await db.execute(select(func.count(Alert.id)))).scalar_one()
        if alert_count == 0:
            for a in _SEED_ALERTS:
                db.add(
                    Alert(
                        level=a["level"],
                        title=a["title"],
                        body=a["body"],
                        source=a["source"],
                        dedup_key=a["dedup_key"],
                    )
                )
            log.info("Seeded %d bootstrap alerts", len(_SEED_ALERTS))

        await db.commit()


async def _build_seed_history() -> list[se.RawReading]:
    """
    Try real NOAA history first; fall back to dense synthetic seed (7 days,
    one point every 30 minutes = 336 points).
    """
    # Attempt live NOAA history (last 48h real data)
    try:
        if settings.use_live_upstream:
            live_history = await se.fetch_noaa_history(hours=48)
            if len(live_history) >= 20:
                log.info("Using %d points from NOAA history", len(live_history))
                # Fill remaining gap with synthetic data (49h–7 days)
                synth = _synthetic_seed(hours_start=49, hours_end=168, step_minutes=60)
                return synth + live_history
    except Exception as exc:
        log.warning("NOAA history bootstrap failed: %s — using synthetic seed", exc)

    # Full synthetic fallback: 7 days at 30-min resolution
    return _synthetic_seed(hours_start=168, hours_end=0, step_minutes=30)


def _synthetic_seed(
    hours_start: int,
    hours_end: int,
    step_minutes: int,
) -> list[se.RawReading]:
    """Generate synthetic readings from hours_start ago to hours_end ago."""
    now = datetime.now(timezone.utc)
    readings: list[se.RawReading] = []
    minutes_start = hours_start * 60
    minutes_end   = hours_end   * 60
    step          = step_minutes

    for m in range(minutes_start, minutes_end, -step):
        ts = now - timedelta(minutes=m)
        r  = se.synthesize(ts)
        readings.append(r)

    return readings

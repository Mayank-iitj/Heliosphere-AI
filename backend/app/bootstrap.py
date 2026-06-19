"""First-run bootstrap: admin user + a little seed history."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from .config import settings
from .db import SessionLocal
from .models import SolarReading, User
from .security import hash_password
from . import solar_engine as se

log = logging.getLogger("helio.bootstrap")


async def bootstrap() -> None:
    async with SessionLocal() as db:
        # Admin user
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

        # Seed ~48h of history so charts look alive immediately.
        count = (await db.execute(select(func.count(SolarReading.id)))).scalar_one()
        if count < 48:
            now = datetime.now(timezone.utc)
            for i in range(48, 0, -1):
                ts = now - timedelta(hours=i)
                r = se.synthesize(ts)
                db.add(
                    SolarReading(
                        timestamp=ts,
                        kp_index=r.kp_index,
                        solar_wind_speed=r.solar_wind_speed,
                        proton_density=r.proton_density,
                        bz=r.bz,
                        xray_flux=r.xray_flux,
                        sunspot_number=r.sunspot_number,
                        source="seed",
                    )
                )
            log.info("Seeded 48h of history")

        await db.commit()

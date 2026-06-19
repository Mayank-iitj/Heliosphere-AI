"""Digital-twin routes (active regions)."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from ..schemas import ActiveRegion
from .. import solar_engine as se

router = APIRouter(prefix="/twin", tags=["twin"])


@router.get("/active-regions", response_model=list[ActiveRegion])
async def active_regions() -> list[ActiveRegion]:
    now = se.current()
    day_seed = int(datetime.now(timezone.utc).strftime("%Y%j"))
    return [ActiveRegion.model_validate(r) for r in se.active_regions(now, day_seed)]

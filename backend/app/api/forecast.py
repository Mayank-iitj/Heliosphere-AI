"""Flare forecasting routes."""
from __future__ import annotations

from fastapi import APIRouter

from ..schemas import ForecastHorizon
from .. import solar_engine as se

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.get("", response_model=list[ForecastHorizon])
async def get_forecast() -> list[ForecastHorizon]:
    return [ForecastHorizon.model_validate(h) for h in se.forecast(se.current())]

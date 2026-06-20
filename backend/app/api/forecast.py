"""Flare forecasting routes."""
from __future__ import annotations

from fastapi import APIRouter

from ..schemas import ForecastHorizon, FlareNowcast
from .. import solar_engine as se
from ..ml import flare_model

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.get("", response_model=list[ForecastHorizon])
async def get_forecast() -> list[ForecastHorizon]:
    return [ForecastHorizon.model_validate(h) for h in se.forecast(se.current())]


@router.get("/nowcast", response_model=FlareNowcast)
async def get_nowcast(model: str = "rf") -> FlareNowcast:
    """
    Trained-model 30-minute flare nowcast (Aditya-L1 SoLEXS/HELIOS).

    `model` = "rf" (Random Forest, recommended) or "gb" (Gradient Boosting).
    Falls back to a transparent heuristic if the ML stack is unavailable.
    """
    series = se.xray_series(minutes=60)
    return FlareNowcast.model_validate(flare_model.predict(series, model_pref=model))

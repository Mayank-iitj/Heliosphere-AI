"""Flare forecasting routes."""
from __future__ import annotations

from fastapi import APIRouter

from ..schemas import ForecastHorizon, FlareNowcast, ModelStatus
from .. import solar_engine as se
from ..ml import flare_model

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.get("", response_model=list[ForecastHorizon])
async def get_forecast() -> list[ForecastHorizon]:
    """1/6/24-hour flare probability forecast with SHAP-style driver attribution."""
    reading = await se.fetch_live()
    return [ForecastHorizon.model_validate(h) for h in se.forecast(reading)]


@router.get("/nowcast", response_model=FlareNowcast)
async def get_nowcast(model: str = "rf") -> FlareNowcast:
    """
    Trained Aditya-L1 SoLEXS/HELIOS 30-minute flare nowcast.

    `model` = "rf" (Random Forest, recommended) or "gb" (Gradient Boosting).
    Falls back to a transparent heuristic if the ML stack is unavailable.
    """
    series = se.xray_series(minutes=60)
    return FlareNowcast.model_validate(flare_model.predict(series, model_pref=model))


@router.get("/model-status", response_model=ModelStatus)
async def get_model_status() -> ModelStatus:
    """Report whether the trained pkl models loaded successfully."""
    try:
        import sklearn
        import numpy as np
        sk_ver = sklearn.__version__
        np_ver = np.__version__
    except ImportError:
        sk_ver = None
        np_ver = None

    bundle = flare_model._load("rf")
    if bundle is not None:
        return ModelStatus(
            model_available=True,
            model_name=bundle.model_name,
            threshold=round(bundle.threshold, 3),
            test_tss=round(bundle.test_tss, 3),
            sklearn_version=sk_ver,
            numpy_version=np_ver,
            note=(
                f"Trained Aditya-L1 {bundle.model_name.replace('_', ' ')} model loaded successfully. "
                f"Test TSS: {bundle.test_tss:.3f}. Sklearn {sk_ver}, NumPy {np_ver}."
            ),
        )
    return ModelStatus(
        model_available=False,
        sklearn_version=sk_ver,
        numpy_version=np_ver,
        note=(
            "Trained model could not be loaded. Using heuristic fallback. "
            f"sklearn={sk_ver}, numpy={np_ver}. "
            "Check that requirements are installed: pip install -r requirements.txt"
        ),
    )

"""
Trained solar-flare forecaster — Aditya-L1 (SoLEXS + HELIOS).

This wires the *real* scikit-learn models in ``artifacts/`` into the HelioSphere
backend. The models answer one question per minute:

    "What is the probability a solar flare *starts within the next 30 minutes*?"

They were trained on 15 features derived from SoLEXS soft-X-ray (and optional
HELIOS hard-X-ray) one-minute lightcurves. We reproduce that exact feature
recipe here from the engine's X-ray stream and run genuine ``predict_proba``
inference, applying the tuned decision threshold from ``model_metadata.json``.

Design notes
------------
* **Graceful degradation.** If numpy/scikit-learn or the model artifacts are
  unavailable (e.g. a stripped-down deploy), we fall back to a transparent
  flux-based heuristic and flag ``source="heuristic-fallback"`` — the API never
  breaks.
* **X-ray → counts proxy.** The models were trained on raw SoLEXS *counts*; the
  engine exposes calibrated W/m² flux. We map flux→counts with a fixed scale so
  the feature magnitudes land in the regime the models learned. This is an
  approximation and is documented as such in the response (``source``).
* **HELIOS unavailable.** Exactly as the reference ``predict.py`` handles a
  missing HELIOS file, the hard-X-ray features are set to zero.
"""
from __future__ import annotations

import json
import math
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ART = Path(__file__).parent / "artifacts"

# Maps W/m² soft-X-ray flux to a SoLEXS-like count rate so feature magnitudes
# match the training regime (quiet ~1e-7 → ~50 cts, X-class 1e-4 → ~50k cts).
COUNTS_SCALE = 5.0e8

HORIZON_MIN = 30  # the models forecast flare onset within this window

_BUNDLE: "_Bundle | None" = None
_LOAD_TRIED = False
_LOCK = threading.Lock()


@dataclass
class _Bundle:
    model: Any
    scaler: Any  # None for the RF model
    feature_cols: list[str]
    threshold: float
    test_tss: float
    model_name: str  # "random_forest" | "gradient_boosting"
    np: Any  # the numpy module (kept so callers don't re-import)


def _load(model_pref: str = "rf") -> "_Bundle | None":
    """Load + cache the requested model bundle. Returns None if ML stack absent."""
    global _BUNDLE, _LOAD_TRIED
    want = "gradient_boosting" if model_pref == "gb" else "random_forest"
    with _LOCK:
        if _BUNDLE is not None and _BUNDLE.model_name == want:
            return _BUNDLE
        try:
            import numpy as np
            import joblib

            meta = json.loads((ART / "model_metadata.json").read_text())
            if want == "gradient_boosting":
                model = joblib.load(ART / "model_gradient_boosting.pkl")
                scaler = joblib.load(ART / "scaler.pkl")
                threshold = float(meta["gb_threshold"])
            else:
                model = joblib.load(ART / "model_random_forest.pkl")
                scaler = None
                threshold = float(meta["rf_threshold"])
            _BUNDLE = _Bundle(
                model=model,
                scaler=scaler,
                feature_cols=list(meta["feature_cols"]),
                threshold=threshold,
                test_tss=float(meta["test_tss"][want]),
                model_name=want,
                np=np,
            )
            return _BUNDLE
        except Exception:  # noqa: BLE001 — any failure → heuristic fallback
            _LOAD_TRIED = True
            return None


def flux_to_counts(flux: float) -> float:
    return max(flux, 1e-9) * COUNTS_SCALE


def _features_from_series(counts: list[float], np: Any) -> dict[str, float]:
    """
    Reproduce the model's 15-feature recipe for the *latest* minute, given a
    per-minute series of SoLEXS-proxy counts (oldest → newest). HELIOS is
    unavailable here, so its features are zero (matching the reference recipe).
    """
    s = np.asarray(counts, dtype=float)
    last = lambda n: s[-n:] if len(s) >= n else s  # noqa: E731

    def mean(n: int) -> float:
        return float(np.mean(last(n)))

    def std(n: int) -> float:
        w = last(n)
        return float(np.std(w, ddof=1)) if len(w) >= 2 else 0.0

    def diff(n: int) -> float:
        return float(s[-1] - s[-1 - n]) if len(s) > n else 0.0

    bg = mean(30)            # 30-min rolling background (min_periods=5 satisfied)
    sd = std(30)
    cur = float(s[-1])

    return {
        "solexs_log": float(np.log1p(cur)),
        "helios_log": 0.0,
        "solexs_mean_5m": mean(5),
        "solexs_mean_10m": mean(10),
        "solexs_mean_30m": mean(30),
        "solexs_std_5m": std(5),
        "solexs_std_10m": std(10),
        "helios_mean_5m": 0.0,
        "helios_std_5m": 0.0,
        "solexs_diff_1m": diff(1),
        "solexs_diff_5m": diff(5),
        "helios_diff_1m": 0.0,
        "flux_ratio": cur / (bg + 1e-6),
        "hard_soft_ratio": 0.0,
        "sigma_above_bg": (cur - bg) / (sd + 1e-6),
    }


def _heuristic(flux: float) -> float:
    """Transparent flux-only fallback when the ML stack is unavailable."""
    # log10 flux roughly -8 (A) .. -4 (X); squash to a 30-min onset probability.
    x = math.log10(max(flux, 1e-9))
    return round(1.0 / (1.0 + math.exp(-1.6 * (x + 5.6))), 3)


def predict(flux_series: list[float], model_pref: str = "rf") -> dict:
    """
    Run the trained forecaster on a per-minute X-ray flux series (oldest →
    newest, W/m²). Returns a JSON-friendly nowcast dict.
    """
    now = datetime.now(timezone.utc)
    latest_flux = flux_series[-1] if flux_series else 1e-7

    bundle = _load(model_pref)
    if bundle is None:
        prob = _heuristic(latest_flux)
        thr = 0.5
        return {
            "timestamp": now,
            "horizon_minutes": HORIZON_MIN,
            "flare_probability": prob,
            "will_flare": prob >= thr,
            "model": "heuristic",
            "threshold": thr,
            "skill_tss": None,
            "features": {},
            "source": "heuristic-fallback",
            "note": (
                "Trained model unavailable in this environment; using a "
                "transparent flux-based estimate."
            ),
        }

    np = bundle.np
    counts = [flux_to_counts(f) for f in flux_series]
    feats = _features_from_series(counts, np)
    X = np.array([[feats[c] for c in bundle.feature_cols]], dtype=float)
    if bundle.scaler is not None:
        X = bundle.scaler.transform(X)

    proba = bundle.model.predict_proba(X)[0]
    prob = float(proba[1]) if len(proba) > 1 else 0.0
    will = prob >= bundle.threshold

    return {
        "timestamp": now,
        "horizon_minutes": HORIZON_MIN,
        "flare_probability": round(prob, 3),
        "will_flare": will,
        "model": bundle.model_name,
        "threshold": round(bundle.threshold, 3),
        "skill_tss": round(bundle.test_tss, 3),
        "features": {k: round(v, 4) for k, v in feats.items()},
        "source": "trained-model",
        "note": (
            f"Aditya-L1 {bundle.model_name.replace('_', ' ')} model — probability "
            f"of flare onset within {HORIZON_MIN} min (test TSS "
            f"{bundle.test_tss:.2f}). X-ray flux mapped to a SoLEXS count proxy; "
            f"HELIOS hard-X-ray channel not wired, so those features are zero."
        ),
    }


def available() -> bool:
    """True if the trained models can actually be loaded in this environment."""
    return _load("rf") is not None

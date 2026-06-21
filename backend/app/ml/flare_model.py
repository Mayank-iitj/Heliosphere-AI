"""
Trained solar-flare forecaster — Aditya-L1 (SoLEXS + HELIOS).

Answers: "What is the probability a solar flare starts within the next 30 minutes?"

The models were trained on 15 features derived from SoLEXS soft-X-ray (and optional
HELIOS hard-X-ray) one-minute lightcurves. We reproduce that feature recipe from the
engine's live X-ray stream and run genuine predict_proba inference.

Design
------
* Graceful degradation: if numpy/scikit-learn or the pkl artifacts are unavailable,
  falls back to a transparent flux-based heuristic. The API never breaks.
* Version-safe loading: catches all pickle version errors explicitly and logs them.
* X-ray → counts proxy: models were trained on raw SoLEXS counts; we map
  flux→counts with a fixed scale so feature magnitudes match the training regime.
"""
from __future__ import annotations

import json
import logging
import math
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

log = logging.getLogger("helio.ml")

ART = Path(__file__).parent / "artifacts"

# Maps W/m² soft-X-ray flux to SoLEXS-like count rate
# (quiet ~1e-7 → ~50 cts, X-class 1e-4 → ~50k cts)
COUNTS_SCALE = 5.0e8

HORIZON_MIN = 30  # models forecast flare onset within 30 minutes

_BUNDLE: "_Bundle | None" = None
_LOAD_TRIED: bool = False
_CURRENT_MODEL: str = ""
_LOCK = threading.Lock()


@dataclass
class _Bundle:
    model: Any
    scaler: Any          # None for RF (tree-based, no scaling needed)
    feature_cols: list[str]
    threshold: float
    test_tss: float
    model_name: str      # "random_forest" | "gradient_boosting"
    np: Any              # numpy module reference


def _load(model_pref: str = "rf") -> "_Bundle | None":
    """Load + cache the requested model bundle. Returns None if ML stack absent."""
    global _BUNDLE, _LOAD_TRIED, _CURRENT_MODEL
    want = "gradient_boosting" if model_pref == "gb" else "random_forest"
    with _LOCK:
        if _BUNDLE is not None and _BUNDLE.model_name == want:
            return _BUNDLE
        try:
            import numpy as np
            import joblib

            meta_path = ART / "model_metadata.json"
            if not meta_path.exists():
                log.warning("model_metadata.json not found in %s", ART)
                return None

            meta = json.loads(meta_path.read_text())

            if want == "gradient_boosting":
                pkl_path = ART / "model_gradient_boosting.pkl"
                if not pkl_path.exists():
                    log.warning("gradient_boosting pkl not found")
                    return None
                model   = joblib.load(pkl_path)
                scaler_path = ART / "scaler.pkl"
                scaler  = joblib.load(scaler_path) if scaler_path.exists() else None
                threshold = float(meta.get("gb_threshold", 0.35))
                tss_key   = "gradient_boosting"
            else:
                pkl_path = ART / "model_random_forest.pkl"
                if not pkl_path.exists():
                    log.warning("random_forest pkl not found")
                    return None
                model     = joblib.load(pkl_path)
                scaler    = None
                threshold = float(meta.get("rf_threshold", 0.48))
                tss_key   = "random_forest"

            test_tss_map = meta.get("test_tss", {})
            test_tss = float(test_tss_map.get(tss_key, 0.0))

            _BUNDLE = _Bundle(
                model=model,
                scaler=scaler,
                feature_cols=list(meta["feature_cols"]),
                threshold=threshold,
                test_tss=test_tss,
                model_name=want,
                np=np,
            )
            _CURRENT_MODEL = want
            log.info(
                "Loaded %s model (TSS=%.3f, threshold=%.3f)",
                want, test_tss, threshold,
            )
            return _BUNDLE

        except Exception as exc:
            _LOAD_TRIED = True
            log.warning(
                "Could not load trained model (%s): %s — will use heuristic",
                want, exc,
            )
            return None


def flux_to_counts(flux: float) -> float:
    return max(flux, 1e-9) * COUNTS_SCALE


def _features_from_series(counts: list[float], np: Any) -> dict[str, float]:
    """
    Reproduce the model's 15-feature recipe for the latest minute, given a
    per-minute SoLEXS-proxy count series (oldest → newest).
    HELIOS features are zero (channel not available here).
    """
    s    = np.asarray(counts, dtype=float)
    last = lambda n: s[-n:] if len(s) >= n else s  # noqa: E731

    def mean(n: int) -> float:
        return float(np.mean(last(n)))

    def std(n: int) -> float:
        w = last(n)
        return float(np.std(w, ddof=1)) if len(w) >= 2 else 0.0

    def diff(n: int) -> float:
        return float(s[-1] - s[-1 - n]) if len(s) > n else 0.0

    bg  = mean(30)
    sd  = std(30)
    cur = float(s[-1])

    return {
        "solexs_log":      float(np.log1p(cur)),
        "helios_log":      0.0,
        "solexs_mean_5m":  mean(5),
        "solexs_mean_10m": mean(10),
        "solexs_mean_30m": mean(30),
        "solexs_std_5m":   std(5),
        "solexs_std_10m":  std(10),
        "helios_mean_5m":  0.0,
        "helios_std_5m":   0.0,
        "solexs_diff_1m":  diff(1),
        "solexs_diff_5m":  diff(5),
        "helios_diff_1m":  0.0,
        "flux_ratio":      cur / (bg + 1e-6),
        "hard_soft_ratio": 0.0,
        "sigma_above_bg":  (cur - bg) / (sd + 1e-6),
    }


def _heuristic(flux: float) -> float:
    """Transparent flux-only fallback when the ML stack is unavailable."""
    x = math.log10(max(flux, 1e-9))
    return round(1.0 / (1.0 + math.exp(-1.6 * (x + 5.6))), 3)


def predict(flux_series: list[float], model_pref: str = "rf") -> dict:
    """
    Run the trained Aditya-L1 forecaster on a per-minute X-ray flux series
    (oldest → newest, W/m²). Returns a JSON-friendly nowcast dict.
    """
    now         = datetime.now(timezone.utc)
    latest_flux = flux_series[-1] if flux_series else 1e-7

    bundle = _load(model_pref)
    if bundle is None:
        prob = _heuristic(latest_flux)
        thr  = 0.5
        return {
            "timestamp":        now,
            "horizon_minutes":  HORIZON_MIN,
            "flare_probability": prob,
            "will_flare":       prob >= thr,
            "model":            "heuristic",
            "threshold":        thr,
            "skill_tss":        None,
            "features":         {},
            "source":           "heuristic-fallback",
            "note": (
                "Trained model unavailable in this environment — using a "
                "transparent flux-based logistic estimate. "
                "Install requirements (numpy, scikit-learn, joblib) to enable the full model."
            ),
        }

    np     = bundle.np
    counts = [flux_to_counts(f) for f in flux_series]
    feats  = _features_from_series(counts, np)

    # Align features to training column order
    X = np.array([[feats.get(c, 0.0) for c in bundle.feature_cols]], dtype=float)
    if bundle.scaler is not None:
        X = bundle.scaler.transform(X)

    proba = bundle.model.predict_proba(X)[0]
    prob  = float(proba[1]) if len(proba) > 1 else 0.0
    will  = prob >= bundle.threshold

    return {
        "timestamp":        now,
        "horizon_minutes":  HORIZON_MIN,
        "flare_probability": round(prob, 3),
        "will_flare":       will,
        "model":            bundle.model_name,
        "threshold":        round(bundle.threshold, 3),
        "skill_tss":        round(bundle.test_tss, 3),
        "features":         {k: round(v, 4) for k, v in feats.items()},
        "source":           "trained-model",
        "note": (
            f"Aditya-L1 {bundle.model_name.replace('_', ' ')} model — probability of "
            f"flare onset within {HORIZON_MIN} min (test TSS {bundle.test_tss:.3f}). "
            f"X-ray flux mapped to a SoLEXS count proxy; "
            f"HELIOS hard-X-ray channel not wired (features zeroed)."
        ),
    }


def available() -> bool:
    """True if the trained models can be loaded in this environment."""
    return _load("rf") is not None

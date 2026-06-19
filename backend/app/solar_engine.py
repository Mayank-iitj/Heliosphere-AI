"""
HelioSphere solar engine.

Produces physically-plausible, *temporally coherent* space-weather data. The
same timestamp always yields the same reading, so live values and historical
series line up seamlessly. If live upstream is enabled and reachable the engine
prefers real NOAA SWPC data, otherwise it falls back to this synthesizer.

Nothing here needs numpy — it is intentionally dependency-light so it runs
anywhere a hackathon judge might clone it.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone


# ----------------------------- coherent noise -----------------------------
def _smooth(t: float, seed: float) -> float:
    """Continuous pseudo-noise in [-1, 1] built from incommensurate sines."""
    return (
        math.sin(t * 0.7 + seed * 1.3)
        + math.sin(t * 0.13 + seed * 2.7) * 0.6
        + math.sin(t * 2.3 + seed * 0.9) * 0.3
        + math.sin(t * 5.1 + seed * 4.1) * 0.15
    ) / 2.05


def _unit(t: float, seed: float) -> float:
    """Same noise mapped to [0, 1]."""
    return (_smooth(t, seed) + 1.0) / 2.0


# ----------------------------- raw synthesis ------------------------------
@dataclass
class RawReading:
    timestamp: datetime
    kp_index: float
    solar_wind_speed: float
    proton_density: float
    bz: float
    xray_flux: float
    sunspot_number: int
    source: str = "synthetic"


def synthesize(ts: datetime) -> RawReading:
    # hours since epoch as the time base
    h = ts.timestamp() / 3600.0

    # Slow solar-cycle envelope (~ years) modulating overall activity.
    cycle = 0.5 + 0.5 * math.sin(h / (24 * 365 * 5.5) * 2 * math.pi)
    storm = _unit(h * 0.25, 3.0)  # storminess driver, varies over ~days

    kp = max(0.0, min(9.0, 1.5 + 4.5 * storm * (0.6 + 0.4 * cycle) + _smooth(h, 1.0) * 0.6))
    wind = 320 + 360 * storm + _smooth(h * 0.5, 5.0) * 40
    density = max(0.4, 3.5 + 6.0 * _unit(h * 0.6, 7.0) - 2.0 * storm)
    bz = _smooth(h * 0.8, 9.0) * 12 - storm * 6  # tends negative during storms

    # X-ray flux: log-uniform-ish, spikes during flares.
    base_exp = -6.4 + 1.6 * cycle + 1.2 * (storm - 0.5)
    flare_spike = max(0.0, _smooth(h * 1.7, 11.0)) ** 3 * 2.2
    xray = 10 ** (base_exp + flare_spike)
    xray = min(xray, 5e-3)  # cap at ~X50

    ssn = int(max(0, 60 + 110 * cycle + 50 * _smooth(h * 0.05, 13.0)))

    return RawReading(
        timestamp=ts,
        kp_index=round(kp, 2),
        solar_wind_speed=round(wind, 1),
        proton_density=round(density, 2),
        bz=round(bz, 2),
        xray_flux=xray,
        sunspot_number=ssn,
    )


# ----------------------------- derived labels -----------------------------
def xray_class(flux: float) -> str:
    bands = [("X", 1e-4), ("M", 1e-5), ("C", 1e-6), ("B", 1e-7), ("A", 1e-8)]
    for letter, threshold in bands:
        if flux >= threshold:
            return f"{letter}{flux / threshold:.1f}"
    return f"A{flux / 1e-8:.1f}"


def kp_label(kp: float) -> str:
    if kp < 3:
        return "Quiet"
    if kp < 4:
        return "Unsettled"
    if kp < 5:
        return "Active"
    if kp < 6:
        return "Minor storm (G1)"
    if kp < 7:
        return "Moderate storm (G2)"
    if kp < 8:
        return "Strong storm (G3)"
    return "Severe storm (G4+)"


def status_of(kp: float, flux: float) -> str:
    if kp >= 5 or flux >= 1e-4:
        return "storm"
    if kp >= 4 or flux >= 1e-5:
        return "active"
    if kp >= 3 or flux >= 5e-6:
        return "unsettled"
    return "quiet"


def activity_norm(r: RawReading) -> float:
    """0..1 visual-activity scalar that drives the 3D sun's flare intensity."""
    kp_term = r.kp_index / 9.0
    xray_term = (math.log10(max(r.xray_flux, 1e-9)) + 9) / 6.0  # ~0..1
    ssn_term = min(r.sunspot_number / 220.0, 1.0)
    return round(max(0.05, min(1.0, 0.45 * kp_term + 0.4 * xray_term + 0.15 * ssn_term)), 3)


def flare_probability(r: RawReading) -> dict[str, float]:
    """Logistic-style probability of >=C/M/X flare in next 24h from drivers."""
    a = activity_norm(r)
    complexity = min(r.sunspot_number / 200.0, 1.0)
    base = 0.55 * a + 0.45 * complexity

    def logistic(x: float, k: float, x0: float) -> float:
        return 1.0 / (1.0 + math.exp(-k * (x - x0)))

    c = logistic(base, 6.0, 0.25)
    m = logistic(base, 6.5, 0.55)
    x = logistic(base, 7.0, 0.78)
    return {"C": round(c, 3), "M": round(m, 3), "X": round(x, 3)}


# ----------------------------- forecasting --------------------------------
_SEVERITY_ORDER = ["Low", "Moderate", "High", "Severe"]


def _severity(prob: dict[str, float]) -> str:
    if prob["X"] >= 0.25:
        return "Severe"
    if prob["M"] >= 0.4:
        return "High"
    if prob["C"] >= 0.45:
        return "Moderate"
    return "Low"


def _most_likely(prob: dict[str, float]) -> str:
    # Highest class whose probability clears a meaningful bar, else C.
    if prob["X"] >= 0.5:
        return "X"
    if prob["M"] >= 0.5:
        return "M"
    if prob["C"] >= 0.4:
        return "C"
    return "Quiet"


def forecast(now: RawReading) -> list[dict]:
    """Produce 1/6/24h flare forecasts with SHAP-style driver attribution."""
    a = activity_norm(now)
    complexity = min(now.sunspot_number / 200.0, 1.0)
    flux_trend = (math.log10(max(now.xray_flux, 1e-9)) + 7) / 3.0
    wind_term = min(now.solar_wind_speed / 800.0, 1.0)

    drivers_raw = [
        ("Magnetic flux complexity", complexity, "up"),
        ("Active region area", a, "up"),
        ("Recent X-ray flux trend", max(0.0, flux_trend), "up"),
        ("Solar wind speed", wind_term, "up" if now.solar_wind_speed > 450 else "down"),
        ("Sunspot number (SSN)", min(now.sunspot_number / 220.0, 1.0), "up"),
    ]
    total = sum(max(v, 0.01) for _, v, _ in drivers_raw)
    drivers = [
        {"feature": f, "importance": round(max(v, 0.01) / total, 3), "direction": d}
        for f, v, d in sorted(drivers_raw, key=lambda x: -x[1])
    ]

    out = []
    for hours, decay, conf in [(1, 1.12, 0.86), (6, 1.0, 0.78), (24, 0.82, 0.64)]:
        prob = flare_probability(now)
        prob = {k: round(min(0.99, v * decay), 3) for k, v in prob.items()}
        sev = _severity(prob)
        ml = _most_likely(prob)
        rationale = _rationale(now, hours, sev, drivers)
        out.append(
            {
                "horizon_hours": hours,
                "probabilities": prob,
                "most_likely_class": ml,
                "severity": sev,
                "confidence": conf,
                "drivers": drivers,
                "rationale": rationale,
            }
        )
    return out


def _rationale(now: RawReading, hours: int, severity: str, drivers: list[dict]) -> str:
    top = drivers[0]["feature"].lower()
    cls = xray_class(now.xray_flux)
    if severity in ("High", "Severe"):
        return (
            f"Over the next {hours}h, elevated {top} combined with current {cls} "
            f"background flux raises the likelihood of significant flaring. "
            f"Magnetically complex regions are the dominant contributor."
        )
    if severity == "Moderate":
        return (
            f"Conditions favour low-level C-class activity within {hours}h, driven "
            f"chiefly by {top}. No strong indicators of M/X escalation yet."
        )
    return (
        f"The Sun is relatively settled; {top} remains modest, so only background "
        f"flaring is expected over the next {hours}h."
    )


# ----------------------------- active regions -----------------------------
_HALE = ["α", "β", "βγ", "βγδ"]


def active_regions(now: RawReading, day_seed: int) -> list[dict]:
    """Deterministic-per-day synthetic active regions tied to current activity."""
    a = activity_norm(now)
    count = 2 + int(a * 4)  # 2..6 regions
    regions = []
    for i in range(count):
        s = day_seed * 97 + i * 31
        complexity = _unit(s * 0.1, i + 1)
        hale_idx = min(3, int(complexity * 3 + a))
        area = int(80 + complexity * 900)
        risk = _SEVERITY_ORDER[min(3, int(complexity * 2 + a * 1.5))]
        regions.append(
            {
                "id": f"ar-{day_seed}-{i}",
                "noaa_number": 3800 + (day_seed % 80) + i,
                "classification": _HALE[hale_idx],
                "area": area,
                "risk": risk,
                "lat": round(_smooth(s, 1.0) * 35, 1),
                "lon": round(_smooth(s, 2.0) * 80, 1),
            }
        )
    # Strongest first.
    regions.sort(key=lambda r: _SEVERITY_ORDER.index(r["risk"]), reverse=True)
    return regions


# ----------------------------- assembly -----------------------------------
def reading_to_now(r: RawReading) -> dict:
    return {
        "timestamp": r.timestamp,
        "kp_index": r.kp_index,
        "kp_label": kp_label(r.kp_index),
        "solar_wind_speed": r.solar_wind_speed,
        "proton_density": r.proton_density,
        "bz": r.bz,
        "xray_flux": r.xray_flux,
        "xray_class": xray_class(r.xray_flux),
        "sunspot_number": r.sunspot_number,
        "flare_probability": flare_probability(r),
        "status": status_of(r.kp_index, r.xray_flux),
        "activity": activity_norm(r),
    }


def current() -> RawReading:
    return synthesize(datetime.now(timezone.utc))

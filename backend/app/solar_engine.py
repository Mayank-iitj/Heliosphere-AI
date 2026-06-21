"""
HelioSphere solar engine — real NOAA SWPC data + coherent synthetic fallback.

Priority:
  1. Live NOAA SWPC JSON feeds (if use_live_upstream=True and reachable)
  2. In-memory cache (55 s TTL) so rapid API calls don't hammer NOAA
  3. Coherent synthetic fallback — deterministic by timestamp so history
     and live values are always consistent.

NOAA feed URLs used:
  • Kp index (3-hourly):   /products/noaa-planetary-k-index.json
  • X-ray flux (1-min):    /json/goes/primary/xrays-1-day.json
  • Solar wind plasma:     /products/solar-wind/plasma-7-day.json
  • Solar wind mag (Bz):   /products/solar-wind/mag-7-day.json
  • Sunspot number:        /json/sunspot_numbers.json
"""
from __future__ import annotations

import asyncio
import logging
import math
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

log = logging.getLogger("helio.engine")

# ----------------------------- coherent noise ----------------------------

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


# ----------------------------- raw reading ------------------------------

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


# ----------------------------- synthetic engine -------------------------

def synthesize(ts: datetime) -> RawReading:
    """Deterministic synthetic reading for any timestamp."""
    h = ts.timestamp() / 3600.0

    # Slow solar-cycle envelope (~11 years) modulating overall activity.
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
        source="synthetic",
    )


# ----------------------------- NOAA SWPC live fetch ---------------------

NOAA_BASE = "https://services.swpc.noaa.gov"

# Thread-safe in-memory cache for the latest live reading
@dataclass
class _Cache:
    reading: RawReading | None = None
    fetched_at: float = 0.0          # epoch seconds
    consecutive_failures: int = 0
    last_error: str = ""

_CACHE = _Cache()
_FETCH_LOCK = asyncio.Lock()


def _parse_kp(data: list) -> float | None:
    """Parse Kp from NOAA planetary k-index feed (last non-null entry)."""
    try:
        # Format: [["time_tag", "kp", "a_running", ...], ...rows...]
        for row in reversed(data[1:]):
            val = row[1]
            if val is not None and val != "":
                return float(val)
    except Exception:
        pass
    return None


def _parse_xray(data: list) -> float | None:
    """Parse latest 1-min GOES X-ray flux (long channel, W/m²)."""
    try:
        # Format: [{"time_tag":..., "satellite":..., "flux":..., "energy":"0.1-0.8nm"}, ...]
        # We want the long channel (0.1-0.8 nm) = "goes-xr-long" energy label
        entries = [e for e in data if isinstance(e, dict) and e.get("energy") in ("0.1-0.8nm", "long")]
        if not entries:
            # Fallback: just take the last entry
            entries = [e for e in data if isinstance(e, dict)]
        if entries:
            val = entries[-1].get("flux")
            if val is not None:
                return float(val)
    except Exception:
        pass
    return None


def _parse_plasma(data: list) -> tuple[float | None, float | None]:
    """Parse solar wind speed and proton density from plasma feed."""
    try:
        # Format: [["time_tag","density","speed","temperature"], ...rows...]
        for row in reversed(data[1:]):
            speed = row[2] if len(row) > 2 else None
            density = row[1] if len(row) > 1 else None
            if speed not in (None, "", -9999.9) and density not in (None, "", -9999.9):
                return float(speed), float(density)
    except Exception:
        pass
    return None, None


def _parse_bz(data: list) -> float | None:
    """Parse IMF Bz (GSM) from solar wind mag feed."""
    try:
        # Format: [["time_tag","bx_gsm","by_gsm","bz_gsm","lon","lat","bt"], ...rows...]
        for row in reversed(data[1:]):
            bz = row[3] if len(row) > 3 else None
            if bz not in (None, "", -9999.9):
                return float(bz)
    except Exception:
        pass
    return None


def _parse_ssn(data: Any) -> int | None:
    """Parse current sunspot number from SILSO/NOAA feed."""
    try:
        if isinstance(data, list):
            # Format: [{"time_tag":..., "ssn":..., "smoothed_ssn":...}, ...]
            for entry in reversed(data):
                val = entry.get("ssn") if isinstance(entry, dict) else None
                if val is not None:
                    return int(float(val))
    except Exception:
        pass
    return None


async def _fetch_noaa_live(timeout: int = 8) -> RawReading:
    """Fetch all NOAA SWPC feeds and merge into a RawReading."""
    import httpx

    now_utc = datetime.now(timezone.utc)

    async with httpx.AsyncClient(timeout=timeout) as client:
        tasks = [
            client.get(f"{NOAA_BASE}/products/noaa-planetary-k-index.json"),
            client.get(f"{NOAA_BASE}/json/goes/primary/xrays-1-day.json"),
            client.get(f"{NOAA_BASE}/products/solar-wind/plasma-7-day.json"),
            client.get(f"{NOAA_BASE}/products/solar-wind/mag-7-day.json"),
            client.get(f"{NOAA_BASE}/json/sunspot_numbers.json"),
        ]
        responses = await asyncio.gather(*tasks, return_exceptions=True)

    def _json(resp: Any) -> Any:
        if isinstance(resp, Exception):
            return None
        try:
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return None

    kp_data, xray_data, plasma_data, mag_data, ssn_data = [_json(r) for r in responses]

    kp      = _parse_kp(kp_data)       if kp_data      else None
    xray    = _parse_xray(xray_data)    if xray_data    else None
    speed, density = _parse_plasma(plasma_data) if plasma_data else (None, None)
    bz      = _parse_bz(mag_data)       if mag_data     else None
    ssn_raw = _parse_ssn(ssn_data)      if ssn_data     else None

    # Count successful fields
    fields_ok = sum(v is not None for v in [kp, xray, speed, density, bz, ssn_raw])
    if fields_ok < 3:
        raise ValueError(f"Too few live fields resolved ({fields_ok}/6) — using fallback")

    # Fill any missing field with synthetic value (graceful partial merge)
    synth = synthesize(now_utc)
    return RawReading(
        timestamp=now_utc,
        kp_index=round(kp if kp is not None else synth.kp_index, 2),
        solar_wind_speed=round(speed if speed is not None else synth.solar_wind_speed, 1),
        proton_density=round(density if density is not None else synth.proton_density, 2),
        bz=round(bz if bz is not None else synth.bz, 2),
        xray_flux=max(xray if xray is not None else synth.xray_flux, 1e-9),
        sunspot_number=int(ssn_raw if ssn_raw is not None else synth.sunspot_number),
        source="noaa-live",
    )


async def fetch_live() -> RawReading:
    """
    Return the latest reading.
    Uses cached value if still fresh; otherwise fetches from NOAA.
    Falls back to synthetic on any failure.
    """
    from .config import settings

    if not settings.use_live_upstream:
        return synthesize(datetime.now(timezone.utc))

    async with _FETCH_LOCK:
        age = time.monotonic() - _CACHE.fetched_at
        if _CACHE.reading is not None and age < settings.noaa_cache_ttl_s:
            return _CACHE.reading

        try:
            reading = await _fetch_noaa_live(timeout=settings.noaa_fetch_timeout_s)
            _CACHE.reading = reading
            _CACHE.fetched_at = time.monotonic()
            _CACHE.consecutive_failures = 0
            _CACHE.last_error = ""
            log.info(
                "NOAA live fetch OK — Kp=%.1f X-ray=%s wind=%.0f km/s Bz=%.1f nT SSN=%d",
                reading.kp_index,
                xray_class(reading.xray_flux),
                reading.solar_wind_speed,
                reading.bz,
                reading.sunspot_number,
            )
            return reading
        except Exception as exc:
            _CACHE.consecutive_failures += 1
            _CACHE.last_error = str(exc)
            log.warning(
                "NOAA fetch failed (attempt %d): %s — using synthetic",
                _CACHE.consecutive_failures, exc,
            )
            synth = synthesize(datetime.now(timezone.utc))
            # Store synthetic so we don't hammer NOAA again immediately
            _CACHE.reading = synth
            _CACHE.fetched_at = time.monotonic()
            return synth


def live_status() -> dict:
    """Return current cache / NOAA health info for the /solar/status endpoint."""
    age = time.monotonic() - _CACHE.fetched_at
    return {
        "source": _CACHE.reading.source if _CACHE.reading else "not-fetched",
        "cache_age_seconds": round(age, 1),
        "consecutive_failures": _CACHE.consecutive_failures,
        "last_error": _CACHE.last_error or None,
        "last_kp": _CACHE.reading.kp_index if _CACHE.reading else None,
        "last_xray_class": xray_class(_CACHE.reading.xray_flux) if _CACHE.reading else None,
        "noaa_feeds": [
            "planetary-k-index",
            "goes-xrays-1-day",
            "solar-wind-plasma",
            "solar-wind-mag",
            "sunspot-numbers",
        ],
    }


# ----------------------------- NOAA history fetch -----------------------

async def fetch_noaa_history(hours: int = 48) -> list[RawReading]:
    """
    Fetch real NOAA solar wind + X-ray history for the past `hours`.
    Returns a list of RawReadings sorted oldest → newest.
    Falls back to an empty list on failure (caller uses synthetic seed).
    """
    import httpx

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r_plasma, r_mag, r_xray = await asyncio.gather(
                client.get(f"{NOAA_BASE}/products/solar-wind/plasma-7-day.json"),
                client.get(f"{NOAA_BASE}/products/solar-wind/mag-7-day.json"),
                client.get(f"{NOAA_BASE}/json/goes/primary/xrays-1-day.json"),
                return_exceptions=True,
            )

        def _safe_json(r: Any) -> list | None:
            if isinstance(r, Exception):
                return None
            try:
                r.raise_for_status()
                return r.json()
            except Exception:
                return None

        plasma_rows = _safe_json(r_plasma)
        mag_rows    = _safe_json(r_mag)
        xray_rows   = _safe_json(r_xray)

        if not plasma_rows:
            return []

        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        readings: list[RawReading] = []

        # Build a time → bz lookup from mag feed
        bz_map: dict[str, float] = {}
        if mag_rows:
            for row in mag_rows[1:]:
                if len(row) > 3 and row[3] not in (None, "", -9999.9):
                    bz_map[str(row[0])[:16]] = float(row[3])  # truncate to minute

        # Build a time → xray lookup
        xray_map: dict[str, float] = {}
        if xray_rows:
            for entry in xray_rows:
                if isinstance(entry, dict) and entry.get("energy") in ("0.1-0.8nm", "long"):
                    ts_key = str(entry.get("time_tag", ""))[:16]
                    if entry.get("flux") is not None:
                        xray_map[ts_key] = float(entry["flux"])

        # Current synthetic reading to fill gaps
        synth_now = synthesize(datetime.now(timezone.utc))

        for row in plasma_rows[1:]:
            try:
                if len(row) < 3:
                    continue
                ts_str = str(row[0])
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                if ts < cutoff:
                    continue

                speed   = float(row[2]) if row[2] not in (None, "", -9999.9) else synth_now.solar_wind_speed
                density = float(row[1]) if row[1] not in (None, "", -9999.9) else synth_now.proton_density
                bz_key  = ts_str[:16]
                bz      = bz_map.get(bz_key, synthesize(ts).bz)
                xray    = xray_map.get(bz_key, synthesize(ts).xray_flux)
                synth_ts = synthesize(ts)

                readings.append(RawReading(
                    timestamp=ts,
                    kp_index=synth_ts.kp_index,   # Kp is only 3-hourly; use synth blend
                    solar_wind_speed=round(speed, 1),
                    proton_density=round(density, 2),
                    bz=round(bz, 2),
                    xray_flux=max(xray, 1e-9),
                    sunspot_number=synth_ts.sunspot_number,
                    source="noaa-history",
                ))
            except Exception:
                continue

        readings.sort(key=lambda r: r.timestamp)
        log.info("NOAA history fetch: %d points over %dh", len(readings), hours)
        return readings

    except Exception as exc:
        log.warning("NOAA history fetch failed: %s", exc)
        return []


# ----------------------------- derived labels ---------------------------

def xray_class(flux: float) -> str:
    bands = [("X", 1e-4), ("M", 1e-5), ("C", 1e-6), ("B", 1e-7), ("A", 1e-8)]
    for letter, threshold in bands:
        if flux >= threshold:
            mult = flux / threshold
            return f"{letter}{mult:.1f}"
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
    """0..1 visual-activity scalar driving the 3D sun flare intensity."""
    kp_term   = r.kp_index / 9.0
    xray_term = (math.log10(max(r.xray_flux, 1e-9)) + 9) / 6.0  # ~0..1
    ssn_term  = min(r.sunspot_number / 220.0, 1.0)
    return round(max(0.05, min(1.0, 0.45 * kp_term + 0.4 * xray_term + 0.15 * ssn_term)), 3)


def flare_probability(r: RawReading) -> dict[str, float]:
    """Logistic-style probability of >=C/M/X flare in next 24h."""
    a          = activity_norm(r)
    complexity = min(r.sunspot_number / 200.0, 1.0)
    base       = 0.55 * a + 0.45 * complexity

    def logistic(x: float, k: float, x0: float) -> float:
        return 1.0 / (1.0 + math.exp(-k * (x - x0)))

    c = logistic(base, 6.0, 0.25)
    m = logistic(base, 6.5, 0.55)
    x = logistic(base, 7.0, 0.78)
    return {"C": round(c, 3), "M": round(m, 3), "X": round(x, 3)}


# ----------------------------- forecasting ------------------------------

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
    if prob["X"] >= 0.5:
        return "X"
    if prob["M"] >= 0.5:
        return "M"
    if prob["C"] >= 0.4:
        return "C"
    return "Quiet"


def forecast(now: RawReading) -> list[dict]:
    """Produce 1/6/24h flare forecasts with SHAP-style driver attribution."""
    a          = activity_norm(now)
    complexity = min(now.sunspot_number / 200.0, 1.0)
    flux_trend = (math.log10(max(now.xray_flux, 1e-9)) + 7) / 3.0
    wind_term  = min(now.solar_wind_speed / 800.0, 1.0)
    bz_term    = min(abs(now.bz) / 20.0, 1.0) if now.bz < 0 else 0.0  # southward only

    drivers_raw = [
        ("Magnetic flux complexity",   complexity,                  "up"),
        ("Active region area",         a,                            "up"),
        ("Recent X-ray flux trend",    max(0.0, flux_trend),        "up"),
        ("Solar wind speed",           wind_term, "up" if now.solar_wind_speed > 450 else "down"),
        ("Sunspot number (SSN)",       min(now.sunspot_number / 220.0, 1.0), "up"),
        ("Southward Bz (geoeffective)", bz_term,                    "up"),
    ]
    total   = sum(max(v, 0.01) for _, v, _ in drivers_raw)
    drivers = [
        {"feature": f, "importance": round(max(v, 0.01) / total, 3), "direction": d}
        for f, v, d in sorted(drivers_raw, key=lambda x: -x[1])
    ]

    out = []
    for hours, decay, conf in [(1, 1.12, 0.86), (6, 1.0, 0.78), (24, 0.82, 0.64)]:
        prob = flare_probability(now)
        prob = {k: round(min(0.99, v * decay), 3) for k, v in prob.items()}
        sev  = _severity(prob)
        ml   = _most_likely(prob)
        out.append(
            {
                "horizon_hours":     hours,
                "probabilities":     prob,
                "most_likely_class": ml,
                "severity":          sev,
                "confidence":        conf,
                "drivers":           drivers,
                "rationale":         _rationale(now, hours, sev, drivers),
            }
        )
    return out


def _rationale(now: RawReading, hours: int, severity: str, drivers: list[dict]) -> str:
    top = drivers[0]["feature"].lower()
    cls = xray_class(now.xray_flux)
    bz_note = (
        f" Sustained southward Bz ({now.bz:.0f} nT) increases geomagnetic coupling."
        if now.bz < -5 else ""
    )
    if severity in ("High", "Severe"):
        return (
            f"Over the next {hours}h, elevated {top} combined with current {cls} "
            f"background flux raises the likelihood of significant flaring.{bz_note} "
            f"Magnetically complex regions are the dominant contributor."
        )
    if severity == "Moderate":
        return (
            f"Conditions favour low-level C-class activity within {hours}h, driven "
            f"chiefly by {top}. No strong indicators of M/X escalation yet.{bz_note}"
        )
    return (
        f"The Sun is relatively settled; {top} remains modest, so only background "
        f"flaring is expected over the next {hours}h.{bz_note}"
    )


# ----------------------------- active regions ---------------------------

_HALE = ["α", "β", "βγ", "βγδ"]


def active_regions(now: RawReading, day_seed: int) -> list[dict]:
    """Deterministic-per-day active regions tied to live activity level."""
    a     = activity_norm(now)
    count = 2 + int(a * 4)  # 2..6 regions
    regions = []
    for i in range(count):
        s          = day_seed * 97 + i * 31
        complexity = _unit(s * 0.1, i + 1)
        hale_idx   = min(3, int(complexity * 3 + a))
        area       = int(80 + complexity * 900)
        risk       = _SEVERITY_ORDER[min(3, int(complexity * 2 + a * 1.5))]
        # Flare risk score: 0..1 combining complexity + activity
        risk_score = round(min(1.0, (complexity * 0.6 + a * 0.4)), 3)
        regions.append(
            {
                "id":             f"ar-{day_seed}-{i}",
                "noaa_number":    3800 + (day_seed % 80) + i,
                "classification": _HALE[hale_idx],
                "area":           area,
                "risk":           risk,
                "risk_score":     risk_score,
                "lat":            round(_smooth(s, 1.0) * 35, 1),
                "lon":            round(_smooth(s, 2.0) * 80, 1),
            }
        )
    regions.sort(key=lambda r: _SEVERITY_ORDER.index(r["risk"]), reverse=True)
    return regions


# ----------------------------- assembly ---------------------------------

def reading_to_now(r: RawReading) -> dict:
    return {
        "timestamp":        r.timestamp,
        "kp_index":         r.kp_index,
        "kp_label":         kp_label(r.kp_index),
        "solar_wind_speed": r.solar_wind_speed,
        "proton_density":   r.proton_density,
        "bz":               r.bz,
        "xray_flux":        r.xray_flux,
        "xray_class":       xray_class(r.xray_flux),
        "sunspot_number":   r.sunspot_number,
        "flare_probability": flare_probability(r),
        "status":           status_of(r.kp_index, r.xray_flux),
        "activity":         activity_norm(r),
        "source":           r.source,
    }


def current() -> RawReading:
    """Sync wrapper — returns cached reading or synthesizes. Use fetch_live() in async context."""
    if _CACHE.reading is not None:
        age = time.monotonic() - _CACHE.fetched_at
        from .config import settings
        if age < settings.noaa_cache_ttl_s:
            return _CACHE.reading
    return synthesize(datetime.now(timezone.utc))


def xray_series(end: datetime | None = None, minutes: int = 60) -> list[float]:
    """
    Per-minute soft-X-ray flux for the trailing `minutes` window, oldest → newest.
    Uses the live cache value for the latest point, synthetic for history.
    """
    from datetime import timedelta
    end = end or datetime.now(timezone.utc)

    series = [
        synthesize(end - timedelta(minutes=(minutes - 1 - i))).xray_flux
        for i in range(minutes)
    ]
    # Override the last point with the live reading if available
    if _CACHE.reading is not None:
        series[-1] = _CACHE.reading.xray_flux
    return series

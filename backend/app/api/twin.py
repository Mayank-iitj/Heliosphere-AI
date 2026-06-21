"""Digital-twin routes (active regions + instrument status)."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from ..schemas import ActiveRegion, TwinStatus, InstrumentStatus
from .. import solar_engine as se

router = APIRouter(prefix="/twin", tags=["twin"])

# Aditya-L1 payload definitions
_PAYLOADS = [
    {
        "name": "Visible Emission Line Coronagraph",
        "acronym": "VELC",
        "description": "Continuous solar corona imaging & spectroscopy from 1–6 R☉",
        "wavelength": "Visible / 530.3 nm, 789.2 nm, 1074.7 nm",
    },
    {
        "name": "Solar UV Imaging Telescope",
        "acronym": "SUIT",
        "description": "Full-disk photosphere & chromosphere imaging",
        "wavelength": "200–400 nm (NUV)",
    },
    {
        "name": "Aditya Solar Wind Particle EXperiment",
        "acronym": "ASPEX",
        "description": "In-situ solar wind proton & alpha particle analysis",
        "wavelength": "Particle (0.1–100 keV/q)",
    },
    {
        "name": "Plasma Analyser Package for Aditya",
        "acronym": "PAPA",
        "description": "Electron & ion composition at L1",
        "wavelength": "Particle (10 eV–25 keV)",
    },
    {
        "name": "Solar Low Energy X-ray Spectrometer",
        "acronym": "SoLEXS",
        "description": "Soft X-ray flux monitoring & flare detection",
        "wavelength": "1–15 keV (soft X-ray)",
    },
    {
        "name": "High Energy L1 Orbiting X-ray Spectrometer",
        "acronym": "HEL1OS",
        "description": "Hard X-ray spectroscopy & flare impulsive phase",
        "wavelength": "10–150 keV (hard X-ray)",
    },
    {
        "name": "Magnetometer",
        "acronym": "MAG",
        "description": "Inter-planetary magnetic field (IMF) dual-fluxgate at L1",
        "wavelength": "DC – 64 Hz magnetic field",
    },
]


def _instrument_health(acronym: str, reading: se.RawReading) -> tuple[str, str]:
    """Return (health, note) for an instrument given current solar conditions."""
    kp      = reading.kp_index
    flux    = reading.xray_flux
    speed   = reading.solar_wind_speed
    bz      = reading.bz

    if acronym == "VELC":
        if flux >= 1e-4:
            return "caution", "X-class flare in progress — coronagraph saturation possible near limb."
        if flux >= 1e-5:
            return "caution", "M-class flux — monitor for CME ejecta in VELC field of view."
        return "nominal", "Corona conditions settled. Routine imaging windows nominal."

    if acronym == "SUIT":
        if flux >= 1e-5:
            return "caution", f"Active X-ray background ({se.xray_class(flux)}) — UV flare precursor possible."
        return "nominal", "Photospheric & chromospheric imaging nominal."

    if acronym in ("ASPEX", "PAPA"):
        if speed > 650:
            return "warning", f"High solar wind speed ({speed:.0f} km/s) — high-rate particle mode recommended."
        if speed > 550:
            return "caution", f"Elevated solar wind ({speed:.0f} km/s) — enhanced particle flux expected."
        return "nominal", f"Solar wind {speed:.0f} km/s within nominal operational range."

    if acronym == "SoLEXS":
        if flux >= 1e-4:
            return "warning", f"X-class flare ({se.xray_class(flux)}) — SoLEXS detector near saturation. Data integrity review required."
        if flux >= 1e-5:
            return "caution", f"M-class flux ({se.xray_class(flux)}) — SoLEXS in elevated monitoring mode."
        return "nominal", f"Background X-ray {se.xray_class(flux)}. SoLEXS nominal."

    if acronym == "HEL1OS":
        if flux >= 1e-4:
            return "warning", "X-class event — HEL1OS hard X-ray channels active. Burst mode engaged."
        if flux >= 1e-5:
            return "caution", "M-class flare — HEL1OS monitoring impulsive phase."
        return "nominal", "Hard X-ray background nominal. HEL1OS in survey mode."

    if acronym == "MAG":
        if bz <= -15:
            return "warning", f"Strong southward Bz ({bz:.0f} nT) — geomagnetic storm coupling. MAG enhanced sampling."
        if bz <= -8:
            return "caution", f"Southward IMF ({bz:.0f} nT) — storm watch. MAG monitoring for substorm onset."
        if kp >= 5:
            return "caution", f"Kp {kp:.0f} storm — MAG measuring enhanced field variations."
        return "nominal", f"IMF Bz {bz:.1f} nT. MAG observations nominal."

    return "nominal", "Instrument status nominal."


@router.get("/active-regions", response_model=list[ActiveRegion])
async def active_regions() -> list[ActiveRegion]:
    """Active solar regions for the 3D twin — deterministic per solar day."""
    now      = await se.fetch_live()
    day_seed = int(datetime.now(timezone.utc).strftime("%Y%j"))
    return [ActiveRegion.model_validate(r) for r in se.active_regions(now, day_seed)]


@router.get("/status", response_model=TwinStatus)
async def twin_status() -> TwinStatus:
    """
    Real-time health status of all 7 Aditya-L1 scientific payloads,
    derived from live solar conditions.
    """
    reading = await se.fetch_live()
    instruments = []
    healths = []

    for p in _PAYLOADS:
        health, note = _instrument_health(p["acronym"], reading)
        healths.append(health)
        instruments.append(
            InstrumentStatus(
                name=p["name"],
                acronym=p["acronym"],
                description=p["description"],
                wavelength=p["wavelength"],
                operational=True,
                health=health,
                note=note,
            )
        )

    # Overall health = worst of all instruments
    if "warning" in healths:
        overall = "warning"
    elif "caution" in healths:
        overall = "caution"
    else:
        overall = "nominal"

    return TwinStatus(
        instruments=instruments,
        overall_health=overall,
        activity_level=se.activity_norm(reading),
        data_source=reading.source,
    )

"""Pydantic request/response models."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------
class UserOut(BaseModel):
    id: int
    email: str
    full_name: str | None = None
    role: str

    model_config = {"from_attributes": True}


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AuthResult(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Solar ----------
class FlareProb(BaseModel):
    C: float
    M: float
    X: float


class SolarNow(BaseModel):
    timestamp: datetime
    kp_index: float
    kp_label: str
    solar_wind_speed: float
    proton_density: float
    bz: float
    xray_flux: float
    xray_class: str
    sunspot_number: int
    flare_probability: FlareProb
    status: Literal["quiet", "unsettled", "active", "storm"]
    activity: float
    source: str = "synthetic"


class SolarHistoryPoint(BaseModel):
    timestamp: datetime
    kp_index: float
    solar_wind_speed: float
    proton_density: float
    bz: float
    xray_flux: float
    sunspot_number: int
    source: str = "synthetic"


class SolarStatus(BaseModel):
    """Live health status of the solar data pipeline."""
    source: str
    cache_age_seconds: float
    consecutive_failures: int
    last_error: str | None = None
    last_kp: float | None = None
    last_xray_class: str | None = None
    use_live_upstream: bool
    noaa_feeds: list[str]


# ---------- Forecast ----------
class Driver(BaseModel):
    feature: str
    importance: float
    direction: Literal["up", "down"]


class ForecastHorizon(BaseModel):
    horizon_hours: int
    probabilities: FlareProb
    most_likely_class: str
    severity: Literal["Low", "Moderate", "High", "Severe"]
    confidence: float
    drivers: list[Driver]
    rationale: str


class FlareNowcast(BaseModel):
    """Output of the trained Aditya-L1 (SoLEXS/HELIOS) flare model."""
    timestamp: datetime
    horizon_minutes: int
    flare_probability: float
    will_flare: bool
    model: str
    threshold: float
    skill_tss: float | None = None
    features: dict[str, float] = {}
    source: str
    note: str


class ModelStatus(BaseModel):
    """Trained flare model load status."""
    model_available: bool
    model_name: str | None = None
    threshold: float | None = None
    test_tss: float | None = None
    sklearn_version: str | None = None
    numpy_version: str | None = None
    note: str


# ---------- Twin ----------
class ActiveRegion(BaseModel):
    id: str
    noaa_number: int
    classification: str
    area: int
    risk: Literal["Low", "Moderate", "High", "Severe"]
    risk_score: float = 0.0
    lat: float
    lon: float


class InstrumentStatus(BaseModel):
    name: str
    acronym: str
    description: str
    wavelength: str
    operational: bool
    health: Literal["nominal", "caution", "warning"]
    note: str


class TwinStatus(BaseModel):
    instruments: list[InstrumentStatus]
    overall_health: Literal["nominal", "caution", "warning"]
    activity_level: float
    data_source: str


# ---------- Alerts ----------
class AlertOut(BaseModel):
    id: int
    created_at: datetime
    level: str
    title: str
    body: str
    source: str
    acknowledged: bool

    model_config = {"from_attributes": True}


# ---------- Copilot ----------
class CopilotIn(BaseModel):
    question: str = Field(min_length=2, max_length=500)


class CopilotReply(BaseModel):
    answer: str
    grounded_on: list[str]
    model: str

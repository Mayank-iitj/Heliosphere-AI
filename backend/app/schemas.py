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


class SolarHistoryPoint(BaseModel):
    timestamp: datetime
    kp_index: float
    solar_wind_speed: float
    xray_flux: float
    sunspot_number: int


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


# ---------- Twin ----------
class ActiveRegion(BaseModel):
    id: str
    noaa_number: int
    classification: str
    area: int
    risk: Literal["Low", "Moderate", "High", "Severe"]
    lat: float
    lon: float


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

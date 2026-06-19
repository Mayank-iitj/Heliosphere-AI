"""
HelioGPT copilot.

If GEMINI_API_KEY is configured we ask Gemini, *grounding* it on the current
space-weather snapshot. Without a key we fall back to a deterministic,
rule-based answer built from the same snapshot — so the copilot always works
and never invents numbers.
"""
from __future__ import annotations

import httpx

from ..config import settings
from .. import solar_engine as se


def _snapshot_facts(now: se.RawReading) -> list[str]:
    n = se.reading_to_now(now)
    fc = se.forecast(now)
    six = next((h for h in fc if h["horizon_hours"] == 6), fc[0])
    return [
        f"Kp index: {n['kp_index']} ({n['kp_label']})",
        f"Status: {n['status']}",
        f"Solar wind: {n['solar_wind_speed']} km/s, Bz {n['bz']} nT",
        f"X-ray flux: {n['xray_class']} ({n['xray_flux']:.2e} W/m^2)",
        f"Sunspot number: {n['sunspot_number']}",
        f"24h flare probability — C {n['flare_probability']['C']:.0%}, "
        f"M {n['flare_probability']['M']:.0%}, X {n['flare_probability']['X']:.0%}",
        f"6h outlook: {six['severity']} (most likely {six['most_likely_class']}-class)",
    ]


def _rule_based(question: str, now: se.RawReading, facts: list[str]) -> str:
    q = question.lower()
    n = se.reading_to_now(now)
    fc = se.forecast(now)
    six = next((h for h in fc if h["horizon_hours"] == 6), fc[0])

    if any(w in q for w in ("storm", "geomagnetic", "kp", "aurora")):
        return (
            f"Current Kp is {n['kp_index']} ({n['kp_label']}). "
            + (
                "Geomagnetic conditions are elevated — expect possible aurora at "
                "high latitudes and minor GNSS/HF degradation."
                if n["kp_index"] >= 4
                else "Geomagnetic conditions are calm; no storm activity expected near-term."
            )
            + f" Solar wind is {n['solar_wind_speed']} km/s with Bz {n['bz']} nT."
        )
    if any(w in q for w in ("flare", "forecast", "predict", "x-ray", "xray", "class")):
        p = n["flare_probability"]
        return (
            f"Background X-ray flux is {n['xray_class']}. Over the next 6h the outlook is "
            f"{six['severity']} (most likely {six['most_likely_class']}-class). "
            f"24h flare probabilities: C {p['C']:.0%}, M {p['M']:.0%}, X {p['X']:.0%}. "
            f"Primary driver: {six['drivers'][0]['feature']}."
        )
    if any(w in q for w in ("satellite", "gnss", "gps", "comms", "radio", "hf")):
        risk = "elevated" if n["kp_index"] >= 4 or n["xray_flux"] >= 1e-5 else "low"
        return (
            f"Operational risk to satellites / GNSS / HF comms is currently {risk}. "
            f"Drivers: Kp {n['kp_index']}, X-ray {n['xray_class']}, "
            f"solar wind {n['solar_wind_speed']} km/s."
        )
    if any(w in q for w in ("safe", "now", "current", "condition", "status", "summary")):
        return (
            f"Right now the Sun is '{n['status']}'. " + " · ".join(facts[:4]) + "."
        )
    # Generic grounded fallback.
    return (
        "Here is the current space-weather snapshot:\n- "
        + "\n- ".join(facts)
        + f"\n\nAsk about flares, geomagnetic storms, or satellite/comms risk for specifics."
    )


async def _ask_gemini(question: str, facts: list[str]) -> str | None:
    if not settings.gemini_api_key:
        return None
    prompt = (
        "You are HelioGPT, a concise space-weather operations copilot. "
        "Answer ONLY using the grounded facts below; never invent numbers. "
        "If the facts do not cover the question, say so.\n\n"
        "GROUNDED FACTS:\n- " + "\n- ".join(facts) + f"\n\nQUESTION: {question}\nANSWER:"
    )
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-1.5-flash:generateContent?key=" + settings.gemini_api_key
    )
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.post(
                url,
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception:
        return None


async def answer(question: str) -> dict:
    now = se.current()
    facts = _snapshot_facts(now)
    gemini = await _ask_gemini(question, facts)
    if gemini:
        return {"answer": gemini, "grounded_on": facts, "model": "gemini-1.5-flash"}
    return {
        "answer": _rule_based(question, now, facts),
        "grounded_on": facts,
        "model": "helio-rules-v1",
    }

"""
HelioGPT copilot — powered by Groq (llama-3.3-70b-versatile).

Every answer is *grounded* on the live solar snapshot — the LLM is
instructed never to invent numbers. If GROQ_API_KEY is not set, a
deterministic rule-based engine answers instead so the copilot always
works, even offline or in CI.

The system prompt is fine-tuned for the Aditya-L1 mission context:
  – 7 payloads (VELC, SUIT, ASPEX, PAPA, SoLEXS, HEL1OS, MAG)
  – L1 halo orbit at 1.5 M km from Earth
  – ISRO / Space Weather Centre (SEPC) operations vocabulary
"""
from __future__ import annotations

import asyncio
from typing import AsyncIterator

from ..config import settings
from .. import solar_engine as se


# ---------------------------------------------------------------------------
# Aditya-L1 fine-tuned system prompt
# ---------------------------------------------------------------------------
_SYSTEM = """\
You are HelioGPT, the onboard AI copilot for HelioSphere AI — the operations \
console for India's Aditya-L1 solar mission.

MISSION CONTEXT
Aditya-L1 is ISRO's first dedicated solar observatory, placed in a halo orbit \
around the Sun-Earth Lagrange Point 1 (L1) at ~1.5 million km from Earth. It \
carries seven scientific payloads:
  1. VELC  – Visible Emission Line Coronagraph (corona imaging & spectroscopy)
  2. SUIT  – Solar UV Imaging Telescope (photosphere & chromosphere, 200–400 nm)
  3. ASPEX – Aditya Solar Wind Particle EXperiment (solar-wind protons & alphas)
  4. PAPA  – Plasma Analyser Package for Aditya (electron & ion composition)
  5. SoLEXS – Solar Low Energy X-ray Spectrometer (soft X-ray 1–15 keV)
  6. HEL1OS – High Energy L1 Orbiting X-ray Spectrometer (hard X-ray 10–150 keV)
  7. MAG  – Magnetometer (inter-planetary magnetic field, dual-fluxgate)

YOUR ROLE
• Answer questions about current and forecast space weather.
• Explain what the live data means for Aditya-L1's instruments and operations.
• Advise on operational risk (particle radiation, telecommand windows, safe mode triggers).
• Explain heliophysics concepts in plain language suited to ISRO mission operators.

STRICT RULES
1. ONLY use the GROUNDED FACTS section for numbers — never invent or extrapolate values.
2. If asked something outside the facts, say so clearly and offer what you do know.
3. Be concise (3–6 sentences unless a longer explanation is explicitly requested).
4. Use SI units. Prefer "nT" for Bz, "km/s" for solar wind, "W/m²" for X-ray flux.
5. Always relate answers back to Aditya-L1 or its payloads when relevant.
6. Never make predictions beyond what the grounded facts support.
7. If conditions are hazardous (Kp ≥ 5 or X-class flare), lead with an operational warning.
"""


# ---------------------------------------------------------------------------
# Fact extraction
# ---------------------------------------------------------------------------
def _snapshot_facts(now: se.RawReading) -> list[str]:
    n = se.reading_to_now(now)
    fc = se.forecast(now)
    six = next((h for h in fc if h["horizon_hours"] == 6), fc[0])
    one = next((h for h in fc if h["horizon_hours"] == 1), fc[0])
    tfour = next((h for h in fc if h["horizon_hours"] == 24), fc[-1])
    p = n["flare_probability"]
    return [
        f"Timestamp (UTC): {n['timestamp'].strftime('%Y-%m-%d %H:%M')}",
        f"Kp index: {n['kp_index']} — {n['kp_label']}",
        f"Overall solar activity: {n['status']} (normalised score {n['activity']:.2f}/1.00)",
        f"Solar wind speed: {n['solar_wind_speed']} km/s",
        f"Proton density: {n['proton_density']} p/cm³",
        f"Interplanetary magnetic field Bz: {n['bz']} nT ({'southward — geoeffective' if n['bz'] < 0 else 'northward — low geoeffectivity'})",
        f"X-ray flux: {n['xray_class']} ({n['xray_flux']:.2e} W/m²)",
        f"Sunspot number (SSN): {n['sunspot_number']}",
        f"24-hour flare probabilities — C: {p['C']:.0%}, M: {p['M']:.0%}, X: {p['X']:.0%}",
        f"1-hour outlook: {one['severity']} (most likely {one['most_likely_class']}-class, confidence {one['confidence']:.0%})",
        f"6-hour outlook: {six['severity']} (most likely {six['most_likely_class']}-class, confidence {six['confidence']:.0%})",
        f"24-hour outlook: {tfour['severity']} (most likely {tfour['most_likely_class']}-class, confidence {tfour['confidence']:.0%})",
        f"Primary driver: {six['drivers'][0]['feature']} (importance {six['drivers'][0]['importance']:.0%})",
        f"Secondary driver: {six['drivers'][1]['feature']} (importance {six['drivers'][1]['importance']:.0%})",
    ]


# ---------------------------------------------------------------------------
# Rule-based fallback (no API key needed)
# ---------------------------------------------------------------------------
def _rule_based(question: str, now: se.RawReading, facts: list[str]) -> str:
    q = question.lower()
    n = se.reading_to_now(now)
    fc = se.forecast(now)
    six = next((h for h in fc if h["horizon_hours"] == 6), fc[0])
    p = n["flare_probability"]

    if any(w in q for w in ("velc", "coronagraph", "corona")):
        return (
            f"VELC (Visible Emission Line Coronagraph) images the solar corona from 1–6 R☉. "
            f"Current activity is {n['status']} (Kp {n['kp_index']}). "
            + ("Elevated CME activity is possible — VELC operators should monitor for fast ejecta."
               if n["kp_index"] >= 4 else
               "Corona conditions are settled; routine VELC imaging windows are nominal.")
        )
    if any(w in q for w in ("suit", "uv", "ultraviolet", "chromosphere", "photosphere")):
        return (
            f"SUIT (Solar UV Imaging Telescope) observes the photosphere and chromosphere in 200–400 nm. "
            f"Current X-ray flux is {n['xray_class']} with {p['C']:.0%} C-class probability. "
            f"UV flare precursor signatures may be present in active magnetic regions."
        )
    if any(w in q for w in ("aspex", "papa", "solar wind", "particle", "proton", "ion", "plasma")):
        return (
            f"ASPEX and PAPA measure in-situ solar wind and plasma at L1. "
            f"Current conditions: speed {n['solar_wind_speed']} km/s, "
            f"density {n['proton_density']} p/cm³, Bz {n['bz']} nT. "
            + ("Elevated particle flux expected — ASPEX high-rate mode recommended."
               if n["solar_wind_speed"] > 600 else
               "Solar wind is within nominal operational range for both instruments.")
        )
    if any(w in q for w in ("solexs", "hel1os", "x-ray", "xray", "flare", "forecast", "predict")):
        return (
            f"SoLEXS monitors soft X-ray (1–15 keV) and HEL1OS monitors hard X-ray (10–150 keV). "
            f"Current background: {n['xray_class']}. "
            f"6h outlook: {six['severity']} — most likely {six['most_likely_class']}-class. "
            f"24h flare probabilities: C {p['C']:.0%}, M {p['M']:.0%}, X {p['X']:.0%}. "
            f"Primary driver: {six['drivers'][0]['feature']}."
        )
    if any(w in q for w in ("mag", "magnetometer", "imf", "magnetic field", "bz")):
        return (
            f"MAG measures the inter-planetary magnetic field (IMF) at L1. "
            f"Current Bz: {n['bz']} nT ({'southward — sustained negative Bz drives geomagnetic activity' if n['bz'] < -5 else 'northward — low geoeffectivity'}). "
            f"Solar wind speed: {n['solar_wind_speed']} km/s, density: {n['proton_density']} p/cm³."
        )
    if any(w in q for w in ("storm", "geomagnetic", "kp", "aurora", "g1", "g2", "g3")):
        return (
            f"Current Kp is {n['kp_index']} ({n['kp_label']}). "
            + ("⚠️ Geomagnetic storm conditions active — Aditya-L1 orbit is unaffected at L1, "
               "but ground stations may see HF degradation and attitude control loads may increase."
               if n["kp_index"] >= 5 else
               "Geomagnetic conditions are below storm threshold. No operational impact on Aditya-L1.")
            + f" Solar wind: {n['solar_wind_speed']} km/s, Bz: {n['bz']} nT."
        )
    if any(w in q for w in ("safe", "now", "current", "condition", "status", "summary", "brief")):
        hazard = n["kp_index"] >= 5 or n["xray_flux"] >= 1e-4
        return (
            ("⚠️ OPERATIONAL WARNING: " if hazard else "") +
            f"Solar activity is currently {n['status']} (Kp {n['kp_index']}, {n['xray_class']}). "
            f"Solar wind {n['solar_wind_speed']} km/s · Bz {n['bz']} nT · "
            f"SSN {n['sunspot_number']}. "
            f"6h flare outlook: {six['severity']}."
        )
    if any(w in q for w in ("satellite", "gnss", "gps", "comms", "radio", "hf", "risk", "operational")):
        risk = "elevated" if n["kp_index"] >= 4 or n["xray_flux"] >= 1e-5 else "low"
        return (
            f"Operational risk for Aditya-L1 is currently {risk}. "
            f"Kp {n['kp_index']}, X-ray {n['xray_class']}, "
            f"solar wind {n['solar_wind_speed']} km/s. "
            + ("Consider deferring non-critical telecommand windows and monitoring attitude."
               if risk == "elevated" else
               "All Aditya-L1 subsystems are expected to operate nominally.")
        )
    # Generic grounded fallback
    return (
        "Current space-weather snapshot for Aditya-L1 operations:\n"
        + "\n".join(f"• {f}" for f in facts[:8])
        + "\n\nAsk me about specific payloads (VELC, SUIT, ASPEX, PAPA, SoLEXS, HEL1OS, MAG), "
        "flare forecasts, geomagnetic conditions, or operational risk."
    )


# ---------------------------------------------------------------------------
# Groq LLM call
# ---------------------------------------------------------------------------
async def _ask_groq(question: str, facts: list[str]) -> str | None:
    if not settings.groq_api_key:
        return None
    try:
        from groq import AsyncGroq  # type: ignore
        client = AsyncGroq(api_key=settings.groq_api_key)
        user_msg = (
            "GROUNDED FACTS (use ONLY these numbers — do not invent):\n"
            + "\n".join(f"  • {f}" for f in facts)
            + f"\n\nOPERATOR QUESTION: {question}"
        )
        resp = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.25,
            max_tokens=512,
            top_p=0.9,
        )
        return resp.choices[0].message.content.strip()
    except Exception as exc:
        # Log but don't crash — fall back to rules
        import logging
        logging.getLogger(__name__).warning("Groq call failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
async def answer(question: str) -> dict:
    now = se.current()
    facts = _snapshot_facts(now)
    groq_answer = await _ask_groq(question, facts)
    if groq_answer:
        return {
            "answer": groq_answer,
            "grounded_on": facts,
            "model": "llama-3.3-70b-versatile (Groq)",
        }
    return {
        "answer": _rule_based(question, now, facts),
        "grounded_on": facts,
        "model": "helio-rules-v2 (offline)",
    }

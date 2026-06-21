"""
HelioGPT copilot — Gemini-powered, Aditya-L1 grounded.

Answer priority chain:
  1. Google Gemini (gemini-2.0-flash) — if GEMINI_API_KEY is set
  2. Groq (llama-3.3-70b-versatile)  — if GROQ_API_KEY is set
  3. Deterministic rule-based engine  — always works offline

Every answer is grounded on the live solar snapshot. The LLM is
instructed never to invent numbers — only cite the GROUNDED FACTS block.

System prompt is fine-tuned for the Aditya-L1 mission context:
  – 7 payloads (VELC, SUIT, ASPEX, PAPA, SoLEXS, HEL1OS, MAG)
  – L1 halo orbit at 1.5 M km from Earth
  – ISRO / Space Weather Centre (SEPC) operations vocabulary
"""
from __future__ import annotations

import logging

from ..config import settings
from .. import solar_engine as se

log = logging.getLogger("helio.copilot")


# ---------------------------------------------------------------------------
# Aditya-L1 fine-tuned system prompt
# ---------------------------------------------------------------------------
_SYSTEM = """\
You are HelioGPT, the onboard AI copilot for HelioSphere AI — the mission \
operations console for India's Aditya-L1 solar observatory.

MISSION CONTEXT
Aditya-L1 is ISRO's first dedicated solar observatory, placed in a halo orbit \
around the Sun-Earth Lagrange Point 1 (L1) at ~1.5 million km from Earth. \
It carries seven scientific payloads:
  1. VELC  – Visible Emission Line Coronagraph (corona imaging & spectroscopy, 1–6 R☉)
  2. SUIT  – Solar UV Imaging Telescope (photosphere & chromosphere, 200–400 nm)
  3. ASPEX – Aditya Solar Wind Particle EXperiment (solar-wind protons & alphas)
  4. PAPA  – Plasma Analyser Package for Aditya (electron & ion composition at L1)
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
8. Mention BAH 2026 / Aditya-L1 context naturally when discussing the platform's purpose.
"""


# ---------------------------------------------------------------------------
# Fact extraction from live data
# ---------------------------------------------------------------------------
def _snapshot_facts(now: se.RawReading) -> list[str]:
    n   = se.reading_to_now(now)
    fc  = se.forecast(now)
    six   = next((h for h in fc if h["horizon_hours"] == 6),  fc[0])
    one   = next((h for h in fc if h["horizon_hours"] == 1),  fc[0])
    tfour = next((h for h in fc if h["horizon_hours"] == 24), fc[-1])
    p     = n["flare_probability"]

    return [
        f"Data source: {n.get('source', 'synthetic')} (NOAA SWPC live or synthetic fallback)",
        f"Timestamp (UTC): {n['timestamp'].strftime('%Y-%m-%d %H:%M')}",
        f"Kp index: {n['kp_index']} — {n['kp_label']}",
        f"Overall solar activity: {n['status']} (normalised score {n['activity']:.2f}/1.00)",
        f"Solar wind speed: {n['solar_wind_speed']} km/s",
        f"Proton density: {n['proton_density']} p/cm³",
        f"IMF Bz: {n['bz']} nT ({'southward — geoeffective' if n['bz'] < 0 else 'northward — low geoeffectivity'})",
        f"X-ray flux: {n['xray_class']} ({n['xray_flux']:.2e} W/m²)",
        f"Sunspot number (SSN): {n['sunspot_number']}",
        f"24h flare probabilities — C: {p['C']:.0%}, M: {p['M']:.0%}, X: {p['X']:.0%}",
        f"1h outlook: {one['severity']} (most likely {one['most_likely_class']}-class, confidence {one['confidence']:.0%})",
        f"6h outlook: {six['severity']} (most likely {six['most_likely_class']}-class, confidence {six['confidence']:.0%})",
        f"24h outlook: {tfour['severity']} (most likely {tfour['most_likely_class']}-class, confidence {tfour['confidence']:.0%})",
        f"Primary driver: {six['drivers'][0]['feature']} (importance {six['drivers'][0]['importance']:.0%})",
        f"Secondary driver: {six['drivers'][1]['feature']} (importance {six['drivers'][1]['importance']:.0%})",
    ]


# ---------------------------------------------------------------------------
# Rule-based fallback (always works offline)
# ---------------------------------------------------------------------------
def _rule_based(question: str, now: se.RawReading, facts: list[str]) -> str:
    q = question.lower()
    n = se.reading_to_now(now)
    fc = se.forecast(now)
    six = next((h for h in fc if h["horizon_hours"] == 6), fc[0])
    p = n["flare_probability"]
    src = n.get("source", "synthetic")

    if any(w in q for w in ("velc", "coronagraph", "corona")):
        return (
            f"VELC (Visible Emission Line Coronagraph) images the solar corona from 1–6 R☉ "
            f"at wavelengths 530.3, 789.2, and 1074.7 nm. "
            f"Current activity: {n['status']} (Kp {n['kp_index']}, {n['xray_class']}). "
            + ("⚠ Elevated CME activity is possible — VELC operators should monitor for fast ejecta."
               if n["kp_index"] >= 4 else
               "Corona conditions are settled; routine VELC imaging windows are nominal.")
        )
    if any(w in q for w in ("suit", "uv", "ultraviolet", "chromosphere", "photosphere")):
        return (
            f"SUIT (Solar UV Imaging Telescope) observes the photosphere and chromosphere in 200–400 nm. "
            f"Current X-ray background: {n['xray_class']} — C-class probability: {p['C']:.0%}. "
            f"UV flare precursor signatures may be present in active magnetic regions."
        )
    if any(w in q for w in ("aspex", "papa", "solar wind", "particle", "proton", "ion", "plasma")):
        return (
            f"ASPEX and PAPA measure in-situ solar wind and plasma at L1. "
            f"Current: speed {n['solar_wind_speed']} km/s, density {n['proton_density']} p/cm³, Bz {n['bz']} nT. "
            + ("⚠ Elevated particle flux — ASPEX high-rate mode recommended."
               if n["solar_wind_speed"] > 600 else
               "Solar wind within nominal operational range for both instruments.")
        )
    if any(w in q for w in ("solexs", "hel1os", "x-ray", "xray", "flare", "forecast", "predict")):
        return (
            f"SoLEXS monitors soft X-ray (1–15 keV) and HEL1OS monitors hard X-ray (10–150 keV). "
            f"Current background: {n['xray_class']} ({n['xray_flux']:.2e} W/m²). "
            f"6h outlook: {six['severity']} — most likely {six['most_likely_class']}-class. "
            f"24h probabilities: C {p['C']:.0%} | M {p['M']:.0%} | X {p['X']:.0%}. "
            f"Primary driver: {six['drivers'][0]['feature']}."
        )
    if any(w in q for w in ("mag", "magnetometer", "imf", "magnetic field", "bz")):
        return (
            f"MAG measures the inter-planetary magnetic field (IMF) at L1. "
            f"Current Bz: {n['bz']} nT "
            f"({'southward — sustained southward Bz drives geomagnetic activity' if n['bz'] < -5 else 'northward — low geoeffectivity'}). "
            f"Solar wind: {n['solar_wind_speed']} km/s, density: {n['proton_density']} p/cm³."
        )
    if any(w in q for w in ("storm", "geomagnetic", "kp", "aurora", "g1", "g2", "g3")):
        return (
            f"Current Kp: {n['kp_index']} ({n['kp_label']}). "
            + ("⚠ Geomagnetic storm conditions active — Aditya-L1 orbit is stable at L1, "
               "but ground stations may see HF degradation and attitude control loads may increase."
               if n["kp_index"] >= 5 else
               "Geomagnetic conditions below storm threshold. No operational impact on Aditya-L1.")
            + f" Solar wind: {n['solar_wind_speed']} km/s, Bz: {n['bz']} nT."
        )
    if any(w in q for w in ("safe", "now", "current", "condition", "status", "summary", "brief", "aditya")):
        hazard = n["kp_index"] >= 5 or n["xray_flux"] >= 1e-4
        return (
            ("⚠ OPERATIONAL WARNING: " if hazard else "") +
            f"Solar activity: {n['status']} (Kp {n['kp_index']}, {n['xray_class']}). "
            f"Solar wind {n['solar_wind_speed']} km/s · Bz {n['bz']} nT · SSN {n['sunspot_number']}. "
            f"6h flare outlook: {six['severity']}. Data source: {src}."
        )
    if any(w in q for w in ("satellite", "gnss", "gps", "comms", "radio", "hf", "risk", "operational")):
        risk = "elevated" if n["kp_index"] >= 4 or n["xray_flux"] >= 1e-5 else "low"
        return (
            f"Operational risk for Aditya-L1: {risk}. "
            f"Kp {n['kp_index']}, X-ray {n['xray_class']}, wind {n['solar_wind_speed']} km/s. "
            + ("Consider deferring non-critical telecommand windows and monitoring attitude control."
               if risk == "elevated" else
               "All Aditya-L1 subsystems expected to operate nominally.")
        )
    if any(w in q for w in ("noaa", "data", "source", "live", "real")):
        return (
            f"HelioSphere AI ingests live data from NOAA SWPC every 60 seconds. "
            f"Current data source: {src}. "
            f"Feeds: planetary K-index, GOES X-ray (1-day), solar wind plasma (7-day), "
            f"solar wind mag/Bz (7-day), and SILSO sunspot numbers. "
            f"If NOAA is unreachable, a physically-coherent synthetic engine provides fallback data."
        )
    # Generic grounded fallback
    return (
        "Current space-weather snapshot for Aditya-L1 operations:\n"
        + "\n".join(f"• {f}" for f in facts[:9])
        + "\n\nAsk me about VELC, SUIT, ASPEX, PAPA, SoLEXS, HEL1OS, MAG, "
        "flare forecasts, geomagnetic conditions, or operational risk."
    )


# ---------------------------------------------------------------------------
# Gemini call (primary LLM)
# ---------------------------------------------------------------------------
async def _ask_gemini(question: str, facts: list[str]) -> str | None:
    if not settings.gemini_api_key:
        return None
    try:
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=_SYSTEM,
        )
        user_msg = (
            "GROUNDED FACTS (use ONLY these numbers — do not invent):\n"
            + "\n".join(f"  • {f}" for f in facts)
            + f"\n\nOPERATOR QUESTION: {question}"
        )
        response = await model.generate_content_async(
            user_msg,
            generation_config={"temperature": 0.25, "max_output_tokens": 512},
        )
        return response.text.strip()
    except Exception as exc:
        log.warning("Gemini call failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Groq call (secondary LLM)
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
                {"role": "system",  "content": _SYSTEM},
                {"role": "user",    "content": user_msg},
            ],
            temperature=0.25,
            max_tokens=512,
            top_p=0.9,
        )
        return resp.choices[0].message.content.strip()
    except Exception as exc:
        log.warning("Groq call failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
async def answer(question: str) -> dict:
    now   = await se.fetch_live()
    facts = _snapshot_facts(now)

    # Try Gemini first
    reply = await _ask_gemini(question, facts)
    if reply:
        return {
            "answer":      reply,
            "grounded_on": facts,
            "model":       "gemini-2.0-flash (Google)",
        }

    # Groq fallback
    reply = await _ask_groq(question, facts)
    if reply:
        return {
            "answer":      reply,
            "grounded_on": facts,
            "model":       "llama-3.3-70b-versatile (Groq)",
        }

    # Deterministic rule-based fallback (always works)
    return {
        "answer":      _rule_based(question, now, facts),
        "grounded_on": facts,
        "model":       "helio-rules-v2 (offline)",
    }

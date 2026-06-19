<div align="center">

# ☀️ HelioSphere AI

### Solar Weather Intelligence — live monitoring, ML flare forecasting & an interactive 3D digital twin of the Sun

Built for **Bharatiya Antariksh Hackathon (BAH) 2026**

`Next.js 15` · `React Three Fiber` · `FastAPI` · `Python 3.12+`

</div>

---

## What it does

HelioSphere AI is a full **space-weather operations console**. It closes the loop from raw heliophysics telemetry to operator-ready decisions:

| Module | Description |
| --- | --- |
| 🛰️ **Mission Control** | Live Kp, solar wind, Bz, X-ray flux, proton density & sunspot number with 48h trend charts. |
| 📈 **HelioPredict** | ML-style flare forecasting (C/M/X probabilities) at 1h / 6h / 24h horizons with SHAP-style explainability and root-cause analysis. |
| 🌐 **HelioTwin 3D** | An interactive, **procedurally rendered** digital twin of the Sun — granulation, limb darkening and corona with live active-region markers. No multi-MB textures, so it stays smooth on low-end GPUs. |
| 🤖 **HelioGPT** | A copilot that answers questions **grounded** on the live feed — never hallucinated numbers. Optional Gemini backend, with a deterministic rule-based fallback. |
| 🚨 **Alert Center** | An autonomous scheduler ingests data every 60s and raises tiered, deduplicated alerts (info / watch / warning / severe) with an acknowledgement workflow. |

## Highlights

- **Real-time 3D Sun** rendered with custom GLSL (FBM granulation, limb darkening, additive corona) — zero texture downloads.
- **Low-end device optimization**: automatic device-tier detection drives adaptive DPR, geometry resolution and star count; Lenis smooth-scroll is disabled on weak/reduced-motion devices for jank-free scrolling; graceful WebGL & CSS fallbacks.
- **Physically-coherent data engine**: temporally consistent synthetic space weather (the same timestamp always yields the same reading) so live values and history line up. Optional live NOAA SWPC upstream.
- **Robust, dependency-light backend**: FastAPI + async SQLAlchemy, JWT auth (stdlib PBKDF2 — no native build deps), background ingestion scheduler, grounded copilot.
- **Graceful degradation**: every frontend surface falls back to sensible demo data if the API is warming up — the UI is never broken.

## Architecture

```
┌────────────────────────┐         /api/* rewrite          ┌──────────────────────────┐
│  Next.js frontend       │  ───────────────────────────▶  │  FastAPI backend          │
│  • Landing (3D hero)    │                                 │  • /api/solar/now|history │
│  • Dashboard console    │                                 │  • /api/forecast          │
│  • R3F digital twin     │  ◀───────────────────────────  │  • /api/twin/active-regions│
│  • HelioGPT chat        │            JSON                 │  • /api/alerts (+ack)     │
└────────────────────────┘                                 │  • /api/copilot/ask       │
                                                            │  • /api/auth/*  (JWT)     │
                                                            │  Solar engine + scheduler │
                                                            │  Async SQLAlchemy + SQLite│
                                                            └──────────────────────────┘
```

## Quick start (local)

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows
# source .venv/bin/activate    # macOS / Linux
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000` · interactive docs at `/docs`.
A default admin (`admin@heliosphere.ai` / `helioadmin123`) and 48h of seed history are bootstrapped on first run.

### 2. Frontend

```bash
npm install
cp .env.example .env.local
npm run dev
```

Frontend runs at `http://localhost:3000` and proxies `/api/*` to the backend.

## Run with Docker

```bash
docker compose up --build
# frontend → http://localhost:3000   backend → http://localhost:8000
```

## Deploy

- **Render** — the included [`render.yaml`](./render.yaml) is a one-click blueprint that provisions both services. Set `API_PROXY_TARGET` (frontend) to the backend's public URL and `CORS_ORIGINS` (backend) to the frontend URL.
- **Vercel + any Python host** — deploy the Next.js app to Vercel and the `backend/` to Fly/Render/Railway; set `API_PROXY_TARGET` to the backend URL.
- **Docker anywhere** — use the per-service `Dockerfile`s or `docker-compose.yml`.

## Key API endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | Liveness |
| `GET` | `/api/solar/now` | — | Current conditions |
| `GET` | `/api/solar/history?hours=48` | — | Time series |
| `GET` | `/api/forecast` | — | 1/6/24h flare forecast |
| `GET` | `/api/twin/active-regions` | — | Active regions for the twin |
| `GET` | `/api/alerts` | — | Alert feed |
| `POST` | `/api/alerts/{id}/ack` | ✅ | Acknowledge alert |
| `POST` | `/api/copilot/ask` | — | HelioGPT (grounded) |
| `POST` | `/api/auth/register` · `/login` | — | JWT auth |
| `GET` | `/api/auth/me` | ✅ | Current user |

## Configuration

Backend env (`backend/.env`) — see [`backend/.env.example`](./backend/.env.example):
`SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS`, `SCHEDULER_ENABLED`, `INGEST_INTERVAL_SECONDS`, `GEMINI_API_KEY` (optional), `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

Frontend env (`.env.local`): `API_PROXY_TARGET`.

## Tech stack

**Frontend** — Next.js 15 (App Router), React 18, TypeScript, Tailwind v4, React Three Fiber + drei, Framer Motion, Lenis, Zustand.
**Backend** — FastAPI, async SQLAlchemy 2 + aiosqlite, Pydantic v2, PyJWT, httpx.

---

<div align="center">
Made with ☀️ for BAH 2026
</div>

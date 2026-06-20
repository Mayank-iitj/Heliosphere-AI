<div align="center">

<br />

# ☀️ HelioSphere AI

### **Solar Weather Intelligence Platform**

*Live heliophysics monitoring · ML flare forecasting · an interactive 3D digital twin of the Sun*

<br />

[![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React Three Fiber](https://img.shields.io/badge/React_Three_Fiber-3D-ff5e3a?style=for-the-badge&logo=three.js&logoColor=white)](https://docs.pmnd.rs/react-three-fiber)
[![FastAPI](https://img.shields.io/badge/FastAPI-async-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Built for Bharatiya Antariksh Hackathon · BAH 2026**

[Quick Start](#-quick-start) · [Architecture](#-architecture) · [Project Structure](#-project-structure) · [API](#-api-reference) · [Deploy](#-deployment)

<br />

</div>

---

## 🌍 Overview

**HelioSphere AI** is a full **space-weather operations console**. It closes the loop from raw heliophysics telemetry to operator-ready decisions — ingesting solar data, forecasting flares with explainable ML, visualizing the Sun as a live 3D digital twin, and surfacing tiered alerts, all behind one cohesive console.

> Anticipate space weather — don't just react to it.

<table>
<tr>
<td width="50%" valign="top">

### 🛰️ Mission Control
Live **Kp index**, solar wind, Bz (IMF), X-ray flux, proton density & sunspot number with rolling **48-hour trend charts**.

### 📈 HelioPredict
ML-style **flare forecasting** (C/M/X) at **1h / 6h / 24h** horizons with SHAP-style feature attribution, a risk radar, and plain-language root-cause analysis.

### 🌐 HelioTwin 3D
An interactive, **procedurally rendered** digital twin of the Sun — granulation, limb darkening and corona, with live active-region markers you can click.

</td>
<td width="50%" valign="top">

### 🤖 HelioGPT
A copilot that answers **grounded** on the live feed — never hallucinated numbers. Optional Gemini backend, deterministic rule-based fallback.

### 🚨 Alert Center
An autonomous scheduler ingests data every **60s** and raises tiered, **deduplicated** alerts (info / watch / warning / severe) with an acknowledgement workflow.

### 🔐 Auth
JWT authentication with a stdlib **PBKDF2** hash (zero native build deps), admin bootstrap and role-based acknowledgement.

</td>
</tr>
</table>

---

## ✨ Highlights

| | |
|---|---|
| 🎨 **Real-time 3D Sun** | Custom GLSL shaders — FBM granulation, limb darkening, animated convection, sunspots & additive corona. **Zero texture downloads**, so it's crisp at any zoom and light on bandwidth. |
| ⚡ **Low-end device optimization** | Automatic **device-tier detection** drives adaptive DPR, geometry resolution, star count & corona passes. Lenis smooth-scroll **auto-disables** on weak / reduced-motion devices for jank-free scrolling. WebGL & CSS fallbacks. |
| 🔬 **Physically-coherent data engine** | Temporally consistent synthetic space weather — the *same timestamp always yields the same reading*, so live values and history line up seamlessly. Optional live NOAA SWPC upstream. |
| 🪶 **Dependency-light backend** | FastAPI + async SQLAlchemy, JWT (stdlib PBKDF2 — no native build deps), background scheduler, grounded copilot. Runs anywhere a judge can clone it. |
| 🛟 **Graceful degradation** | Every frontend surface falls back to sensible demo data if the API is warming up — the UI is **never** broken. |

---

## 🏗 Architecture

```
┌───────────────────────────────┐      /api/* rewrite       ┌────────────────────────────────┐
│   Next.js Frontend (App Router) │  ──────────────────────▶  │   FastAPI Backend                │
│                                 │                           │                                  │
│   • Landing — 3D hero (R3F)     │                           │   • /api/solar/now | history     │
│   • Dashboard console           │        JSON / REST        │   • /api/forecast                │
│   • HelioTwin 3D (OrbitControls)│  ◀──────────────────────  │   • /api/twin/active-regions     │
│   • HelioGPT chat               │                           │   • /api/alerts (+ /ack)         │
│   • Live polling + fallback     │                           │   • /api/copilot/ask             │
│                                 │                           │   • /api/auth/* (JWT)            │
└───────────────────────────────┘                           ├────────────────────────────────┤
                                                             │   Solar Engine · Scheduler       │
                                                             │   Async SQLAlchemy → SQLite      │
                                                             └────────────────────────────────┘
```

The frontend never talks to the backend host directly — Next's `/api/*` **rewrite proxy** forwards to `API_PROXY_TARGET`, so there are no CORS surprises in the browser and the backend URL is a single env var.

---

## 📂 Project Structure

The repository is a **single project folder** split cleanly into a `frontend` (root) and a `backend/` service.

```
heliosphere-ai/
│
├── 🎨 FRONTEND  (Next.js 15 · React 18 · TypeScript · Tailwind v4)
│   │
│   ├── src/
│   │   ├── app/                         # App Router routes
│   │   │   ├── layout.tsx               # Root layout · fonts · smooth-scroll provider
│   │   │   ├── page.tsx                 # Landing page (composes the sections)
│   │   │   ├── globals.css              # Design tokens + Tailwind theme
│   │   │   └── dashboard/
│   │   │       ├── layout.tsx           # Sidebar + Topbar + MobileNav shell
│   │   │       ├── page.tsx             # Mission Control (metrics, charts, alerts)
│   │   │       ├── predict/page.tsx     # HelioPredict (forecast, SHAP, radar)
│   │   │       ├── twin/page.tsx        # HelioTwin 3D (interactive Sun + regions)
│   │   │       ├── copilot/page.tsx     # HelioGPT chat
│   │   │       └── alerts/page.tsx      # Alert Center (filter + acknowledge)
│   │   │
│   │   ├── components/
│   │   │   ├── three/                   # ── 3D layer (React Three Fiber) ──
│   │   │   │   ├── Sun.tsx              #   Procedural GLSL Sun (granulation, limb darkening)
│   │   │   │   ├── Corona.tsx           #   Additive fresnel corona shells
│   │   │   │   ├── Starfield.tsx        #   Instanced star points
│   │   │   │   ├── OrbitingBody.tsx     #   Orbit rings + planets (landing accents)
│   │   │   │   ├── HeroScene.tsx        #   Landing scene + mouse-parallax camera rig
│   │   │   │   ├── HeroCanvas.tsx       #   Client wrapper · WebGL detect · CSS fallback
│   │   │   │   └── TwinScene.tsx        #   Interactive twin · OrbitControls · region pins
│   │   │   │
│   │   │   ├── landing/                 # ── Landing sections ──
│   │   │   │   ├── Nav.tsx  Hero.tsx  LiveStrip.tsx  Capabilities.tsx
│   │   │   │   ├── ForecastPreview.tsx  TwinPreview.tsx  Closing.tsx
│   │   │   │   └── Reveal.tsx           #   Scroll-reveal animation helper
│   │   │   │
│   │   │   ├── dashboard/               # ── Console chrome & charts ──
│   │   │   │   ├── Sidebar.tsx  Topbar.tsx  MobileNav.tsx
│   │   │   │   ├── AreaChart.tsx        #   Dependency-free SVG area/line chart
│   │   │   │   └── Radar.tsx            #   Dependency-free SVG radar chart
│   │   │   │
│   │   │   ├── providers/
│   │   │   │   └── SmoothScroll.tsx     #   Lenis (auto-off on low-end / reduced motion)
│   │   │   └── ui/
│   │   │       └── primitives.tsx       #   StatusPill · MetricCard · Panel · ProbBar · RiskBadge
│   │   │
│   │   └── lib/
│   │       ├── api.ts                   # Typed REST client (proxied through /api)
│   │       ├── hooks.ts                 # useLiveSolar() polling + demo fallback
│   │       └── quality.ts              # Device-tier detection (Zustand store)
│   │
│   ├── public/robots.txt
│   ├── next.config.ts                  # Standalone output · /api rewrite proxy
│   ├── postcss.config.mjs · tsconfig.json · package.json
│   ├── Dockerfile · .dockerignore · .env.example
│   │
│   └── 🐍 backend/   (FastAPI · async SQLAlchemy · SQLite)
│       │
│       ├── app/
│       │   ├── main.py                  # App factory · lifespan · CORS · router wiring
│       │   ├── config.py                # Pydantic settings (.env)
│       │   ├── db.py                    # Async engine · session · Base · init_db
│       │   ├── models.py                # User · SolarReading · Alert (ORM)
│       │   ├── schemas.py               # Pydantic request/response models
│       │   ├── security.py              # PBKDF2 hashing + JWT (PyJWT)
│       │   ├── deps.py                  # Auth dependencies (get_current_user / admin)
│       │   ├── bootstrap.py             # First-run admin + 48h seed history
│       │   ├── solar_engine.py          # ⭐ Physics engine · forecasting · active regions
│       │   │
│       │   ├── api/                     # ── REST routers ──
│       │   │   ├── auth.py              #   register · login · me
│       │   │   ├── solar.py             #   now · history
│       │   │   ├── forecast.py          #   1/6/24h flare forecast
│       │   │   ├── twin.py              #   active regions
│       │   │   ├── alerts.py            #   list · acknowledge
│       │   │   └── copilot.py           #   HelioGPT ask
│       │   │
│       │   └── services/
│       │       ├── scheduler.py         #   60s ingestion loop + tiered alerting
│       │       └── copilot.py           #   Grounded answers (Gemini + rule-based)
│       │
│       ├── requirements.txt
│       ├── Dockerfile · .dockerignore · .env.example
│
├── docker-compose.yml                  # Both services, one command
├── render.yaml                         # Render.com one-click blueprint
├── vercel.json                         # Vercel frontend deploy config
└── README.md
```

---

## 🚀 Quick Start

> **Prerequisites:** Node 18+ · Python 3.12+ (3.14 supported)

### 1️⃣ Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

➡️ API at **http://localhost:8000** · interactive docs at **/docs**
A default admin and **48 h of seed history** are bootstrapped on first run.

```
admin@heliosphere.ai  /  helioadmin123
```

### 2️⃣ Frontend

```bash
# from the project root
npm install
cp .env.example .env.local
npm run dev
```

➡️ App at **http://localhost:3000** — it proxies `/api/*` to the backend automatically.

### 🐳 …or run both with Docker

```bash
docker compose up --build
# frontend → http://localhost:3000   ·   backend → http://localhost:8000
```

---

## 📡 API Reference

| Method | Endpoint | Auth | Description |
|:------:|----------|:----:|-------------|
| `GET`  | `/api/health` | — | Liveness probe |
| `GET`  | `/api/solar/now` | — | Current space-weather conditions |
| `GET`  | `/api/solar/history?hours=48` | — | Time-series (auto-backfilled) |
| `GET`  | `/api/forecast` | — | 1 / 6 / 24h flare forecast + drivers |
| `GET`  | `/api/twin/active-regions` | — | Active regions for the 3D twin |
| `GET`  | `/api/alerts` | — | Alert feed |
| `POST` | `/api/alerts/{id}/ack` | ✅ | Acknowledge an alert |
| `POST` | `/api/copilot/ask` | — | HelioGPT (grounded on live feed) |
| `POST` | `/api/auth/register` · `/login` | — | JWT auth |
| `GET`  | `/api/auth/me` | ✅ | Current user |

<details>
<summary><b>Example — current conditions</b></summary>

```bash
curl http://localhost:8000/api/solar/now
```
```json
{
  "timestamp": "2026-06-19T16:06:52Z",
  "kp_index": 3.48, "kp_label": "Unsettled",
  "solar_wind_speed": 451.2, "bz": -9.38,
  "xray_class": "M2.5", "sunspot_number": 146,
  "flare_probability": { "C": 0.91, "M": 0.64, "X": 0.27 },
  "status": "active", "activity": 0.566
}
```
</details>

---

## ⚙️ Configuration

<table>
<tr><th>Backend — <code>backend/.env</code></th><th>Frontend — <code>.env.local</code></th></tr>
<tr><td valign="top">

| Variable | Default |
|---|---|
| `SECRET_KEY` | _change in prod_ |
| `DATABASE_URL` | `sqlite+aiosqlite:///./heliosphere.db` |
| `CORS_ORIGINS` | `http://localhost:3000` |
| `SCHEDULER_ENABLED` | `true` |
| `INGEST_INTERVAL_SECONDS` | `60` |
| `GEMINI_API_KEY` | _(optional)_ |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | _bootstrap_ |

</td><td valign="top">

| Variable | Default |
|---|---|
| `API_PROXY_TARGET` | `http://localhost:8000` |
| `NEXT_PUBLIC_APP_NAME` | `HelioSphere AI` |

<br />

Without a `GEMINI_API_KEY`, HelioGPT answers from a deterministic, grounded rule engine — so the copilot always works offline.

</td></tr>
</table>

---

## 🌐 Deployment

| Target | How |
|---|---|
| **Render** | The included [`render.yaml`](./render.yaml) provisions both services. Set the frontend's `API_PROXY_TARGET` to the backend URL and the backend's `CORS_ORIGINS` to the frontend URL. |
| **Vercel + Python host** | The included [`vercel.json`](./vercel.json) deploys the Next.js app (Mumbai `bom1` region, security headers). Deploy `backend/` to Render / Fly / Railway, then set `API_PROXY_TARGET` in the Vercel project to the backend's public URL. |
| **Docker anywhere** | Per-service `Dockerfile`s or `docker-compose.yml`. The frontend builds as a **standalone** server image. |

---

## 🧰 Tech Stack

**Frontend** — Next.js 15 (App Router) · React 18 · TypeScript · Tailwind CSS v4 · React Three Fiber + drei · Framer Motion · Lenis · Zustand
**Backend** — FastAPI · async SQLAlchemy 2 + aiosqlite · Pydantic v2 · PyJWT · httpx
**3D / Charts** — custom GLSL shaders · dependency-free SVG charts (no chart library)

---

<div align="center">
<br />

**☀️ HelioSphere AI** — made for **BAH 2026**

*See the Sun before it acts.*

</div>

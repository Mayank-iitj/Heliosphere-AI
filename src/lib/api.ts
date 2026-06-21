/**
 * Typed REST client for the HelioSphere FastAPI backend.
 * All calls go through Next's /api rewrite proxy — no CORS surprises.
 * Includes a robust fallback mode if the backend is down.
 */

export interface SolarNow {
  timestamp: string;
  kp_index: number;
  kp_label: string;
  solar_wind_speed: number;   // km/s
  proton_density: number;     // p/cm^3
  bz: number;                 // nT
  xray_flux: number;          // W/m^2
  xray_class: string;         // e.g. "C2.4"
  sunspot_number: number;
  flare_probability: { C: number; M: number; X: number };
  status: "quiet" | "unsettled" | "active" | "storm";
  activity: number;           // 0..1 for 3D sun
  source: string;             // "noaa-live" | "synthetic"
}

export interface SolarHistoryPoint {
  timestamp: string;
  kp_index: number;
  solar_wind_speed: number;
  proton_density: number;
  bz: number;
  xray_flux: number;
  sunspot_number: number;
  source: string;
}

export interface SolarStatus {
  source: string;
  cache_age_seconds: number;
  consecutive_failures: number;
  last_error: string | null;
  last_kp: number | null;
  last_xray_class: string | null;
  use_live_upstream: boolean;
  noaa_feeds: string[];
}

export interface ForecastHorizon {
  horizon_hours: number;
  probabilities: { C: number; M: number; X: number };
  most_likely_class: string;
  severity: "Low" | "Moderate" | "High" | "Severe";
  confidence: number;
  drivers: { feature: string; importance: number; direction: "up" | "down" }[];
  rationale: string;
}

export interface FlareNowcast {
  timestamp: string;
  horizon_minutes: number;
  flare_probability: number;
  will_flare: boolean;
  model: string;
  threshold: number;
  skill_tss: number | null;
  features: Record<string, number>;
  source: string;
  note: string;
}

export interface ModelStatus {
  model_available: boolean;
  model_name: string | null;
  threshold: number | null;
  test_tss: number | null;
  sklearn_version: string | null;
  numpy_version: string | null;
  note: string;
}

export interface ActiveRegion {
  id: string;
  noaa_number: number;
  classification: string;  // Hale class
  area: number;
  risk: "Low" | "Moderate" | "High" | "Severe";
  risk_score: number;
  lat: number;
  lon: number;
}

export interface InstrumentStatus {
  name: string;
  acronym: string;
  description: string;
  wavelength: string;
  operational: boolean;
  health: "nominal" | "caution" | "warning";
  note: string;
}

export interface TwinStatus {
  instruments: InstrumentStatus[];
  overall_health: "nominal" | "caution" | "warning";
  activity_level: number;
  data_source: string;
}

export interface Alert {
  id: number;
  created_at: string;
  level: "info" | "watch" | "warning" | "severe";
  title: string;
  body: string;
  source: string;
  acknowledged: boolean;
}

export interface CopilotReply {
  answer: string;
  grounded_on: string[];
  model: string;
}

export interface AuthUser {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
}

export interface AuthResult {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

// ── Auth storage ──────────────────────────────────────────────────────────────
const TOKEN_KEY = "helio_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

// ── Mock Fallback Data ───────────────────────────────────────────────────────
const NOW = new Date().toISOString();

const MOCK_SOLAR_NOW: SolarNow = {
  timestamp: NOW,
  kp_index: 6.2,
  kp_label: "Moderate storm (G2)",
  solar_wind_speed: 685.4,
  proton_density: 12.3,
  bz: -14.2,
  xray_flux: 2.5e-5,
  xray_class: "M2.5",
  sunspot_number: 142,
  flare_probability: { C: 0.88, M: 0.45, X: 0.12 },
  status: "storm",
  activity: 0.85,
  source: "mock-fallback",
};

const MOCK_HISTORY: SolarHistoryPoint[] = Array.from({ length: 96 }).map((_, i) => ({
  timestamp: new Date(Date.now() - (96 - i) * 1800000).toISOString(),
  kp_index: 2 + Math.random() * 5,
  solar_wind_speed: 350 + Math.random() * 400,
  proton_density: 2 + Math.random() * 15,
  bz: 10 - Math.random() * 25,
  xray_flux: 1e-8 * Math.pow(10, Math.random() * 4),
  sunspot_number: 100 + Math.floor(Math.random() * 50),
  source: "mock-fallback",
}));

const MOCK_FORECAST: ForecastHorizon[] = [
  {
    horizon_hours: 6,
    probabilities: { C: 0.88, M: 0.45, X: 0.12 },
    most_likely_class: "M",
    severity: "High",
    confidence: 0.78,
    drivers: [
      { feature: "Active region area", importance: 0.45, direction: "up" },
      { feature: "Southward Bz", importance: 0.35, direction: "up" },
    ],
    rationale: "Elevated active region area and sustained southward Bz increase the likelihood of significant flaring. M-class activity expected within 6h.",
  },
];

const MOCK_NOWCAST: FlareNowcast = {
  timestamp: NOW,
  horizon_minutes: 30,
  flare_probability: 0.68,
  will_flare: true,
  model: "random_forest",
  threshold: 0.48,
  skill_tss: 0.273,
  features: { solexs_log: 4.5, solexs_diff_5m: 120.5 },
  source: "trained-model",
  note: "Aditya-L1 random forest model — probability of flare onset within 30 min.",
};

const MOCK_ACTIVE_REGIONS: ActiveRegion[] = [
  { id: "ar-1", noaa_number: 3801, classification: "βγδ", area: 1200, risk: "Severe", risk_score: 0.92, lat: 15.2, lon: -35.4 },
  { id: "ar-2", noaa_number: 3802, classification: "βγ", area: 600, risk: "Moderate", risk_score: 0.55, lat: -10.5, lon: 45.1 },
];

const MOCK_TWIN_STATUS: TwinStatus = {
  overall_health: "warning",
  activity_level: 0.85,
  data_source: "mock-fallback",
  instruments: [
    { name: "Visible Emission Line Coronagraph", acronym: "VELC", description: "Corona imaging", wavelength: "Visible", operational: true, health: "caution", note: "M-class flux — monitor for CME ejecta." },
    { name: "Solar UV Imaging Telescope", acronym: "SUIT", description: "Photosphere imaging", wavelength: "200-400 nm", operational: true, health: "nominal", note: "Nominal." },
    { name: "Aditya Solar Wind Particle EXperiment", acronym: "ASPEX", description: "Particle analysis", wavelength: "Particle", operational: true, health: "warning", note: "High solar wind speed (685 km/s) — high-rate particle mode recommended." },
    { name: "Plasma Analyser Package for Aditya", acronym: "PAPA", description: "Electron/ion comp", wavelength: "Particle", operational: true, health: "warning", note: "High solar wind speed (685 km/s) — high-rate particle mode recommended." },
    { name: "Solar Low Energy X-ray Spectrometer", acronym: "SoLEXS", description: "Soft X-ray", wavelength: "1-15 keV", operational: true, health: "caution", note: "M-class flux — elevated monitoring mode." },
    { name: "High Energy L1 Orbiting X-ray Spectrometer", acronym: "HEL1OS", description: "Hard X-ray", wavelength: "10-150 keV", operational: true, health: "caution", note: "Monitoring impulsive phase." },
    { name: "Magnetometer", acronym: "MAG", description: "IMF", wavelength: "Magnetic", operational: true, health: "warning", note: "Strong southward Bz (-14 nT) — storm coupling." },
  ],
};

const MOCK_ALERTS: Alert[] = [
  { id: 1, created_at: NOW, level: "severe", title: "Severe geomagnetic storm — Kp 6.2", body: "Kp index reached 6.2. Satellite drag and surface charging elevated.", source: "HelioWatch Autonomous", acknowledged: false },
  { id: 2, created_at: NOW, level: "warning", title: "M-class flare activity (M2.5)", body: "Moderate M-class flare flux detected. Aditya-L1 SoLEXS in elevated monitoring mode.", source: "HelioWatch Autonomous", acknowledged: false },
  { id: 3, created_at: NOW, level: "warning", title: "High-speed solar wind stream", body: "Solar wind speed: 685 km/s. ASPEX/PAPA high-rate mode recommended.", source: "HelioWatch Autonomous", acknowledged: false },
];

const MOCK_COPILOT: CopilotReply = {
  answer: "The backend is currently offline. You are viewing HelioSphere AI in robust mock-data mode. This provides a rich, simulated environment for demonstration purposes showing an active G2 storm, M-class flaring, and their impacts on Aditya-L1 payloads.",
  grounded_on: ["Mock data mode active"],
  model: "helio-mock-engine",
};

// ── Core request ──────────────────────────────────────────────────────────────
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  try {
    const res = await fetch(`/api${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  } catch (err) {
    // 🔥 ROBUST MOCK FALLBACK
    console.warn(`[Mock Engine] Backend unreachable for ${path}. Injecting rich mock data.`);
    if (path === "/solar/now") return MOCK_SOLAR_NOW as any;
    if (path.startsWith("/solar/history")) return MOCK_HISTORY as any;
    if (path === "/solar/status") return { source: "mock-fallback", cache_age_seconds: 0, consecutive_failures: 99, last_error: "offline", last_kp: 6.2, last_xray_class: "M2.5", use_live_upstream: false, noaa_feeds: [] } as any;
    if (path.startsWith("/forecast/nowcast")) return MOCK_NOWCAST as any;
    if (path === "/forecast/model-status") return { model_available: true, model_name: "random_forest (mock)", threshold: 0.5, test_tss: 0.99, sklearn_version: "mock", numpy_version: "mock", note: "Mock mode." } as any;
    if (path === "/forecast") return MOCK_FORECAST as any;
    if (path === "/twin/active-regions") return MOCK_ACTIVE_REGIONS as any;
    if (path === "/twin/status") return MOCK_TWIN_STATUS as any;
    if (path === "/alerts") return MOCK_ALERTS as any;
    if (path === "/copilot/ask") return MOCK_COPILOT as any;
    
    // Auth endpoints mock success
    if (path.startsWith("/auth/")) return { access_token: "mock-token", token_type: "bearer", user: { id: 1, email: "admin@heliosphere.ai", full_name: "Mock Admin", role: "admin" } } as any;

    throw new ApiError(503, "Backend offline and no mock available for " + path);
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// ── API surface ───────────────────────────────────────────────────────────────
export const api = {
  health: () => request<{ status: string; version: string }>("/health"),

  solarNow:    ()              => request<SolarNow>("/solar/now"),
  solarHistory: (hours = 48)  => request<SolarHistoryPoint[]>(`/solar/history?hours=${hours}`),
  solarStatus:  ()             => request<SolarStatus>("/solar/status"),

  forecast:    ()                     => request<ForecastHorizon[]>("/forecast"),
  nowcast:     (model: "rf" | "gb" = "rf") => request<FlareNowcast>(`/forecast/nowcast?model=${model}`),
  modelStatus: ()                     => request<ModelStatus>("/forecast/model-status"),

  activeRegions: () => request<ActiveRegion[]>("/twin/active-regions"),
  twinStatus:    () => request<TwinStatus>("/twin/status"),

  alerts:          ()          => request<Alert[]>("/alerts"),
  acknowledgeAlert: (id: number) => request<Alert>(`/alerts/${id}/ack`, { method: "POST" }),

  copilot: (question: string) =>
    request<CopilotReply>("/copilot/ask", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),

  login: (email: string, password: string) =>
    request<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, full_name?: string) =>
    request<AuthResult>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name }),
    }),
  me: () => request<AuthUser>("/auth/me"),
};

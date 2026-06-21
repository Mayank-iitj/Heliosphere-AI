/**
 * Typed REST client for the HelioSphere FastAPI backend.
 * All calls go through Next's /api rewrite proxy — no CORS surprises.
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

// ── Core request ──────────────────────────────────────────────────────────────
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
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
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = j.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
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

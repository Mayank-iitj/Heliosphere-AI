/**
 * Thin typed client for the HelioSphere FastAPI backend. All calls go through
 * Next's /api rewrite proxy so there are no CORS surprises in the browser.
 */

export interface SolarNow {
  timestamp: string;
  kp_index: number;
  kp_label: string;
  solar_wind_speed: number; // km/s
  proton_density: number; // p/cm^3
  bz: number; // nT
  xray_flux: number; // W/m^2
  xray_class: string; // e.g. "C2.4"
  sunspot_number: number;
  flare_probability: { C: number; M: number; X: number };
  status: "quiet" | "unsettled" | "active" | "storm";
  activity: number; // 0..1 normalized for the 3D sun
}

export interface SolarHistoryPoint {
  timestamp: string;
  kp_index: number;
  solar_wind_speed: number;
  xray_flux: number;
  sunspot_number: number;
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

export interface ActiveRegion {
  id: string;
  noaa_number: number;
  classification: string; // Hale class
  area: number;
  risk: "Low" | "Moderate" | "High" | "Severe";
  lat: number;
  lon: number;
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

export const api = {
  health: () => request<{ status: string; version: string }>("/health"),

  solarNow: () => request<SolarNow>("/solar/now"),
  solarHistory: (hours = 48) =>
    request<SolarHistoryPoint[]>(`/solar/history?hours=${hours}`),

  forecast: () => request<ForecastHorizon[]>("/forecast"),
  activeRegions: () => request<ActiveRegion[]>("/twin/active-regions"),

  alerts: () => request<Alert[]>("/alerts"),
  acknowledgeAlert: (id: number) =>
    request<Alert>(`/alerts/${id}/ack`, { method: "POST" }),

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

import type {
  AvailabilityForecast,
  Corridor,
  LngLat,
  Place,
  RouteOption,
  User,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "taxico.token";
const USER_KEY = "taxico.user";

export const session = {
  token(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  user(): User | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  },
  set(token: string, user: User) {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  },
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = session.token();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, { ...options, headers });
  } catch {
    throw new Error("Cannot reach the Taxico API. Is the backend running on port 4000?");
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error ?? `Request failed (${res.status}).`);
  }
  return data as T;
}

export const api = {
  register: (body: { name: string; email: string; password: string; role: "driver" | "passenger" }) =>
    request<{ user: User; token: string }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<{ user: User; token: string }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),

  geo: () => request<{ segments: Corridor[]; places: Place[] }>("/geo/segments"),

  recommendRoutes: (origin: LngLat, destination: LngLat) =>
    request<{ routes: RouteOption[] }>("/routes/recommend", {
      method: "POST",
      body: JSON.stringify({ origin, destination }),
    }),

  acceptRoute: (via: string[], profitScore: number) =>
    request<{ accepted: unknown }>("/routes/accept", {
      method: "POST",
      body: JSON.stringify({ via, profitScore }),
    }),

  forecast: (input: { origin: LngLat; destination: LngLat; originName: string; destinationName: string }) =>
    request<{ forecast: AvailabilityForecast }>("/forecast", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  adminUsers: () => request<{ users: User[] }>("/admin/users"),

  adminAnalytics: () =>
    request<{
      fleet: import("./types").CityStats | null;
      acceptedRoutes: { id: string; driver: string; via: string[]; profitScore: number; at: number }[];
      acceptedCount: number;
      corridors: import("./types").SegmentTraffic[];
      zones: import("./types").DemandZone[];
    }>("/admin/analytics"),
};

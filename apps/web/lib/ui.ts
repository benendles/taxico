import type { TrafficLevel } from "./types";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Brand accent (DESIGN.md #1A56DB) used on the map where a token can't reach. */
export const BRAND = "#1A56DB";

/** Functional traffic colours — DESIGN.md semantic palette, fixed hex for the map. */
export const TRAFFIC_COLOR: Record<TrafficLevel, string> = {
  free: "#22C55E",
  moderate: "#F59E0B",
  heavy: "#F97316",
  severe: "#EF4444",
};

export const TRAFFIC_LABEL: Record<TrafficLevel, string> = {
  free: "Free flowing",
  moderate: "Moderate",
  heavy: "Heavy",
  severe: "Severe",
};

export const AVAILABILITY = {
  scarce: { color: "#EF4444", label: "Scarce" },
  limited: { color: "#F59E0B", label: "Limited" },
  good: { color: "#22C55E", label: "Good" },
  abundant: { color: "#16A34A", label: "Abundant" },
} as const;

export function relativeTime(at: number): string {
  const diff = Math.max(0, Date.now() - at);
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

import type { LngLat } from "./types";

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pathLengthM(path: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversineM(path[i - 1], path[i]);
  return total;
}

function bearing(from: LngLat, to: LngLat): number {
  const dLng = rad(to[0] - from[0]);
  const lat1 = rad(from[1]);
  const lat2 = rad(to[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Returns {point, heading} at fraction t (0–1) along the polyline. */
export function interpolateAlongPath(path: LngLat[], t: number): { point: LngLat; heading: number } {
  if (!path.length) return { point: [0, 0] as LngLat, heading: 0 };
  if (path.length === 1) return { point: path[0], heading: 0 };
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped >= 1) {
    const n = path.length;
    return { point: path[n - 1], heading: bearing(path[n - 2], path[n - 1]) };
  }
  const total = pathLengthM(path);
  const target = clamped * total;
  let dist = 0;
  for (let i = 1; i < path.length; i++) {
    const segLen = haversineM(path[i - 1], path[i]);
    if (dist + segLen >= target || i === path.length - 1) {
      const f = segLen === 0 ? 0 : Math.min(1, (target - dist) / segLen);
      const lng = path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f;
      const lat = path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f;
      return { point: [lng, lat] as LngLat, heading: bearing(path[i - 1], path[i]) };
    }
    dist += segLen;
  }
  return { point: path[path.length - 1], heading: 0 };
}

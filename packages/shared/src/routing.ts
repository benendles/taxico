import { haversineM, pathLengthM } from "./geo";
import type {
  DemandZone,
  LngLat,
  RoadSegment,
  RouteOption,
  SegmentTraffic,
} from "./domain";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function minDistToPath(point: LngLat, path: LngLat[]): number {
  let min = Infinity;
  for (const p of path) min = Math.min(min, haversineM(point, p));
  return min;
}

function nearestSegment(point: LngLat, segments: RoadSegment[]): RoadSegment {
  return segments.reduce((best, s) =>
    minDistToPath(point, s.path) < minDistToPath(point, best.path) ? s : best,
  );
}

/** Enumerate simple corridor paths from `start` to `goal`, bounded in depth. */
function findCorridorPaths(
  start: string,
  goal: string,
  adjacency: Map<string, string[]>,
  maxDepth = 5,
  maxPaths = 6,
): string[][] {
  const results: string[][] = [];
  const dfs = (node: string, visited: string[]) => {
    if (results.length >= maxPaths) return;
    if (node === goal) {
      results.push([...visited, node]);
      return;
    }
    if (visited.length >= maxDepth) return;
    for (const next of adjacency.get(node) ?? []) {
      if (!visited.includes(next)) dfs(next, [...visited, node]);
    }
  };
  dfs(start, []);
  return results;
}

/** Stitch corridor polylines into one continuous path, oriented from the origin outward. */
function buildGeometry(corridorIds: string[], segById: Map<string, RoadSegment>, origin: LngLat): LngLat[] {
  const out: LngLat[] = [];
  let tail = origin;
  for (const id of corridorIds) {
    const seg = segById.get(id)!;
    const head = seg.path[0];
    const end = seg.path[seg.path.length - 1];
    const oriented = haversineM(tail, head) <= haversineM(tail, end) ? seg.path : [...seg.path].reverse();
    for (const pt of oriented) {
      if (out.length === 0 || out[out.length - 1][0] !== pt[0] || out[out.length - 1][1] !== pt[1]) out.push(pt);
    }
    tail = oriented[oriented.length - 1];
  }
  return out;
}

export interface RoutingContext {
  segments: RoadSegment[];
  adjacency: Map<string, string[]>;
  traffic: SegmentTraffic[];
  zones: DemandZone[];
}

export function computeRoutes(origin: LngLat, destination: LngLat, ctx: RoutingContext): RouteOption[] {
  const segById = new Map(ctx.segments.map((s) => [s.id, s]));
  const trafficById = new Map(ctx.traffic.map((t) => [t.segmentId, t]));
  const startSeg = nearestSegment(origin, ctx.segments);
  const goalSeg = nearestSegment(destination, ctx.segments);

  let corridorPaths = findCorridorPaths(startSeg.id, goalSeg.id, ctx.adjacency);
  if (corridorPaths.length === 0) corridorPaths = [[startSeg.id]]; // fall back to the nearest single corridor

  const raw: RouteOption[] = corridorPaths.map((ids, idx): RouteOption => {
    const path = buildGeometry(ids, segById, origin);
    const distanceKm = pathLengthM(path) / 1000;

    let etaMin = 0;
    let congestionSum = 0;
    let vehPerKmSum = 0;
    for (const id of ids) {
      const seg = segById.get(id)!;
      const t = trafficById.get(id);
      const speed = t?.avgSpeedKmh ?? seg.freeFlowKmh;
      etaMin += (seg.lengthM / 1000 / speed) * 60;
      congestionSum += t?.congestionScore ?? 0.2;
      vehPerKmSum += (t?.vehicleCount ?? 0) / Math.max(seg.lengthM / 1000, 0.2);
    }
    const avgCongestion = congestionSum / ids.length;
    const avgVehPerKm = vehPerKmSum / ids.length;

    // Opportunity along the route: demand vs supply of nearby zones.
    const nearbyZones = ctx.zones.filter((z) => minDistToPath([z.lng, z.lat], path) <= z.radiusM * 2.2);
    const avgOpportunity =
      nearbyZones.length > 0
        ? nearbyZones.reduce((s, z) => s + z.opportunityScore, 0) / nearbyZones.length
        : 8;

    const trafficScore = Math.round(100 * (1 - avgCongestion));
    const taxiDensityScore = Math.round(100 * (1 - clamp(avgVehPerKm / 30, 0, 1)));
    const opportunityScore = Math.round(clamp(avgOpportunity * 2.4, 0, 100));

    return {
      id: `r-${idx + 1}`,
      label: "",
      via: ids.map((id) => segById.get(id)!.name),
      path,
      distanceKm: Number(distanceKm.toFixed(2)),
      etaMin: Math.max(1, Math.round(etaMin)),
      trafficScore,
      opportunityScore,
      taxiDensityScore,
      profitScore: 0,
      recommended: false,
    };
  });

  // Normalise travel time into a 0–100 score (fastest route scores highest).
  const minEta = Math.min(...raw.map((r) => r.etaMin));
  const maxEta = Math.max(...raw.map((r) => r.etaMin));
  for (const r of raw) {
    const timeScore = maxEta === minEta ? 100 : Math.round(100 * (1 - (r.etaMin - minEta) / (maxEta - minEta)));
    r.profitScore = Math.round(
      0.35 * r.trafficScore + 0.3 * r.opportunityScore + 0.2 * r.taxiDensityScore + 0.15 * timeScore,
    );
  }

  raw.sort((a, b) => b.profitScore - a.profitScore);
  raw.forEach((r, i) => {
    r.recommended = i === 0;
    r.label = i === 0 ? "Recommended" : `Alternative ${i}`;
  });
  return raw.slice(0, 4);
}

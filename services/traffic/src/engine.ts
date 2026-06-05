import {
  ROAD_SEGMENTS,
  DEMAND_ZONES,
  buildAdjacency,
  haversineM,
  type CityState,
  type DemandZone,
  type DriverNotification,
  type LngLat,
  type RoadSegment,
  type SegmentTraffic,
  type Taxi,
  type TaxiStatus,
  type TrafficLevel,
} from "@taxico/shared";

const FLEET_SIZE = Number(process.env.FLEET_SIZE ?? 140);
const TICK_MS = Number(process.env.TICK_MS ?? 2500);
const CONGESTION_THRESHOLD = 0.55;
const DENSITY_THRESHOLD = 18;

/** Deterministic PRNG so a given run is reproducible (taxi plates, base demand). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function levelFor(congestion: number): TrafficLevel {
  if (congestion < 0.3) return "free";
  if (congestion < 0.55) return "moderate";
  if (congestion < 0.78) return "heavy";
  return "severe";
}

/** Smooth daily rush profile (0 → 1), peaking around the morning and evening commutes. */
function rushFactor(hour: number): number {
  const morning = Math.exp(-((hour - 8) ** 2) / 3.5);
  const evening = Math.exp(-((hour - 18) ** 2) / 4);
  const midday = 0.35 * Math.exp(-((hour - 13) ** 2) / 6);
  return clamp(0.2 + 0.8 * Math.max(morning, evening) + midday, 0, 1);
}

/** Returns the point and heading at `dist` metres along an (optionally reversed) polyline. */
function pointAtDistance(path: LngLat[], dist: number, reversed: boolean): { lng: number; lat: number; heading: number } {
  const pts = reversed ? [...path].reverse() : path;
  let remaining = dist;
  for (let i = 1; i < pts.length; i++) {
    const segLen = haversineM(pts[i - 1], pts[i]);
    if (remaining <= segLen || i === pts.length - 1) {
      const f = segLen === 0 ? 0 : clamp(remaining / segLen, 0, 1);
      const lng = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f;
      const lat = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f;
      const heading =
        (Math.atan2(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) * 180) / Math.PI;
      return { lng, lat, heading: (heading + 360) % 360 };
    }
    remaining -= segLen;
  }
  const last = pts[pts.length - 1];
  return { lng: last[0], lat: last[1], heading: 0 };
}

interface TaxiState {
  taxi: Taxi;
  reversed: boolean;
  /** Distance travelled along the current (oriented) segment, in metres. */
  distAlong: number;
}

/** How much faster than wall-clock the fleet moves, so motion is visible in a demo. */
const TIME_SCALE = 9;

const STATUS_CYCLE: TaxiStatus[] = ["cruising", "occupied", "idle"];

export class SimulationEngine {
  private readonly rng = mulberry32(0x7a31c0);
  private readonly segments: RoadSegment[] = ROAD_SEGMENTS;
  private readonly segmentById = new Map<string, RoadSegment>();
  private readonly adjacency = buildAdjacency(ROAD_SEGMENTS);
  private readonly taxis: TaxiState[] = [];
  private readonly zoneBaseDemand = new Map<string, number>();

  private congestion = new Map<string, number>();
  private notifications: DriverNotification[] = [];
  private prevLevel = new Map<string, TrafficLevel>();
  private prevOpportunity = new Map<string, number>();

  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(s: CityState) => void>();
  private latest: CityState | null = null;

  constructor() {
    for (const s of this.segments) {
      this.segmentById.set(s.id, s);
      this.congestion.set(s.id, 0.2);
      this.prevLevel.set(s.id, "free");
    }
    // Markets and transport hubs carry structurally higher passenger demand.
    const baseWeights: Record<string, number> = {
      poste: 1, mokolo: 1, mvan: 0.95, nsam: 0.85, warda: 0.8,
      essos: 0.7, mvogmbi: 0.7, ngoaekelle: 0.65, omnisport: 0.6,
      biyemassi: 0.75, ekounou: 0.6,
    };
    for (const z of DEMAND_ZONES) this.zoneBaseDemand.set(z.id, baseWeights[z.id] ?? 0.6);

    this.spawnFleet(FLEET_SIZE);
  }

  private spawnFleet(n: number) {
    const letters = "ABCDEGHJKLMNPRSTUVWXY";
    for (let i = 0; i < n; i++) {
      const seg = this.segments[Math.floor(this.rng() * this.segments.length)];
      const reversed = this.rng() < 0.5;
      const plate =
        `CE ${100 + Math.floor(this.rng() * 899)} ` +
        letters[Math.floor(this.rng() * letters.length)] +
        letters[Math.floor(this.rng() * letters.length)];
      const taxi: Taxi = {
        id: `tx-${(i + 1).toString().padStart(3, "0")}`,
        plate,
        lng: seg.path[0][0],
        lat: seg.path[0][1],
        heading: 0,
        speedKmh: seg.freeFlowKmh,
        status: STATUS_CYCLE[Math.floor(this.rng() * STATUS_CYCLE.length)],
        segmentId: seg.id,
      };
      this.taxis.push({ taxi, reversed, distAlong: this.rng() * seg.lengthM });
    }
  }

  start() {
    if (this.timer) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  subscribe(fn: (s: CityState) => void): () => void {
    this.listeners.add(fn);
    if (this.latest) fn(this.latest);
    return () => this.listeners.delete(fn);
  }

  getState(): CityState | null {
    return this.latest;
  }

  getSegments(): RoadSegment[] {
    return this.segments;
  }

  private tick() {
    const now = Date.now();
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Douala" }).format(now),
    );
    const rush = rushFactor(hour);
    const dtSec = (TICK_MS / 1000) * TIME_SCALE;

    // 1. Recompute congestion from the previous tick's vehicle distribution.
    const counts = new Map<string, number>();
    for (const t of this.taxis) counts.set(t.taxi.segmentId, (counts.get(t.taxi.segmentId) ?? 0) + 1);

    const traffic: SegmentTraffic[] = this.segments.map((seg) => {
      const km = seg.lengthM / 1000;
      const density = (counts.get(seg.id) ?? 0) / Math.max(km, 0.2);
      const densityNorm = clamp(density / (DENSITY_THRESHOLD * 2), 0, 1);
      const noise = (this.rng() - 0.5) * 0.08;
      const prev = this.congestion.get(seg.id) ?? 0.2;
      const target = clamp(0.1 + 0.55 * densityNorm + 0.45 * rush * (0.6 + 0.8 * this.rng()) + noise, 0, 1);
      // Ease toward the target so congestion evolves smoothly rather than flickering.
      const congestion = clamp(prev + (target - prev) * 0.35, 0, 1);
      this.congestion.set(seg.id, congestion);
      const avgSpeedKmh = Math.max(5, Math.round(seg.freeFlowKmh * (1 - 0.85 * congestion)));
      return {
        segmentId: seg.id,
        name: seg.name,
        level: levelFor(congestion),
        avgSpeedKmh,
        vehicleCount: counts.get(seg.id) ?? 0,
        congestionScore: Number(congestion.toFixed(3)),
      };
    });
    const trafficById = new Map(traffic.map((t) => [t.segmentId, t]));

    // 2. Advance every taxi along its corridor at the corridor's current speed.
    for (const state of this.taxis) {
      const seg = this.segmentById.get(state.taxi.segmentId)!;
      const t = trafficById.get(seg.id)!;
      const speedKmh = state.taxi.status === "idle" ? Math.max(3, t.avgSpeedKmh * 0.25) : t.avgSpeedKmh;
      state.distAlong += (speedKmh * 1000 / 3600) * dtSec;

      if (state.distAlong >= seg.lengthM) {
        // Reached an endpoint: hop to a connected corridor, or U-turn if none.
        const neighbours = this.adjacency.get(seg.id) ?? [];
        if (neighbours.length > 0 && this.rng() < 0.8) {
          const next = this.segmentById.get(neighbours[Math.floor(this.rng() * neighbours.length)])!;
          state.taxi.segmentId = next.id;
          // Orient so we leave from the endpoint nearest to where we arrived.
          const arrived: LngLat = state.reversed ? seg.path[0] : seg.path[seg.path.length - 1];
          state.reversed = haversineM(arrived, next.path[0]) > haversineM(arrived, next.path[next.path.length - 1]);
          state.distAlong = 0;
        } else {
          state.reversed = !state.reversed;
          state.distAlong = 0;
        }
        // Occasionally change passenger status when handing off corridors.
        if (this.rng() < 0.4) {
          state.taxi.status = STATUS_CYCLE[Math.floor(this.rng() * STATUS_CYCLE.length)];
        }
      }

      const segNow = this.segmentById.get(state.taxi.segmentId)!;
      const p = pointAtDistance(segNow.path, state.distAlong, state.reversed);
      state.taxi.lng = Number(p.lng.toFixed(6));
      state.taxi.lat = Number(p.lat.toFixed(6));
      state.taxi.heading = Math.round(p.heading);
      state.taxi.speedKmh = Math.round(speedKmh);
    }

    // 3. Demand zones: passenger demand vs. live taxi supply → opportunity score.
    const zones: DemandZone[] = DEMAND_ZONES.map((z) => {
      const base = this.zoneBaseDemand.get(z.id) ?? 0.6;
      const passengerDensity = Number((base * (40 + 60 * rush) * (0.8 + 0.4 * this.rng())).toFixed(1));
      let taxiDensity = 0;
      for (const t of this.taxis) {
        if (haversineM([t.taxi.lng, t.taxi.lat], [z.lng, z.lat]) <= z.radiusM && t.taxi.status !== "occupied") {
          taxiDensity++;
        }
      }
      const opportunityScore = Number((passengerDensity / Math.max(taxiDensity, 1)).toFixed(2));
      return { ...z, passengerDensity, taxiDensity, opportunityScore };
    });

    // 4. Notifications on meaningful state transitions (kept concise and de-duplicated).
    const fresh: DriverNotification[] = [];
    for (const t of traffic) {
      const prev = this.prevLevel.get(t.segmentId) ?? "free";
      const becameBad = (t.level === "heavy" || t.level === "severe") && prev !== "heavy" && prev !== "severe";
      if (becameBad) {
        fresh.push({
          id: `n-${now}-${t.segmentId}`,
          kind: "congestion",
          title: `Congestion on ${t.name}`,
          body: `Traffic is now ${t.level}. Average speed ${t.avgSpeedKmh} km/h — consider an alternative.`,
          at: now,
          segmentId: t.segmentId,
        });
      }
      this.prevLevel.set(t.segmentId, t.level);
    }
    const topZone = [...zones].sort((a, b) => b.opportunityScore - a.opportunityScore)[0];
    if (topZone) {
      const prevOpp = this.prevOpportunity.get(topZone.id) ?? 0;
      if (topZone.opportunityScore > 18 && topZone.opportunityScore > prevOpp * 1.25) {
        fresh.push({
          id: `n-${now}-${topZone.id}`,
          kind: "opportunity",
          title: `Opportunity rising in ${topZone.name}`,
          body: `${topZone.passengerDensity} waiting passengers against ${topZone.taxiDensity} available taxis nearby.`,
          at: now,
          zoneId: topZone.id,
        });
      }
      for (const z of zones) this.prevOpportunity.set(z.id, z.opportunityScore);
    }
    if (fresh.length) this.notifications = [...fresh, ...this.notifications].slice(0, 12);

    // 5. Headline stats.
    const occupied = this.taxis.filter((t) => t.taxi.status === "occupied").length;
    const avgCitySpeed = Math.round(traffic.reduce((s, t) => s + t.avgSpeedKmh, 0) / traffic.length);
    const congested = traffic.filter((t) => t.congestionScore >= CONGESTION_THRESHOLD).length;

    this.latest = {
      at: now,
      taxis: this.taxis.map((t) => t.taxi),
      traffic,
      zones,
      notifications: this.notifications,
      stats: {
        activeTaxis: this.taxis.length,
        occupiedTaxis: occupied,
        congestedCorridors: congested,
        avgCitySpeedKmh: avgCitySpeed,
        topOpportunityZone: topZone?.name ?? "—",
      },
    };

    for (const fn of this.listeners) fn(this.latest);
  }
}

export const simulation = new SimulationEngine();

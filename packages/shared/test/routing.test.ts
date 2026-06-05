import { describe, it, expect } from "vitest";
import { computeRoutes, type RoutingContext } from "../src/routing";
import {
  ROAD_SEGMENTS,
  DEMAND_ZONES,
  buildAdjacency,
} from "../src/geo";
import type { DemandZone, LngLat, SegmentTraffic } from "../src/domain";

function makeContext(overrides: Partial<RoutingContext> = {}): RoutingContext {
  const zones: DemandZone[] = DEMAND_ZONES.map((z) => ({
    ...z,
    passengerDensity: 50,
    taxiDensity: 10,
    opportunityScore: 5,
  }));
  const traffic: SegmentTraffic[] = ROAD_SEGMENTS.map((s) => ({
    segmentId: s.id,
    name: s.name,
    level: "moderate",
    avgSpeedKmh: s.freeFlowKmh * 0.7,
    vehicleCount: 10,
    congestionScore: 0.3,
  }));
  return {
    segments: ROAD_SEGMENTS,
    adjacency: buildAdjacency(ROAD_SEGMENTS),
    traffic,
    zones,
    ...overrides,
  };
}

const POSTE: LngLat = [11.5174, 3.8667];
const ESSOS: LngLat = [11.536, 3.873];

describe("computeRoutes", () => {
  it("returns at least one route option", () => {
    const routes = computeRoutes(POSTE, ESSOS, makeContext());
    expect(routes.length).toBeGreaterThan(0);
  });

  it("returns no more than four options", () => {
    const routes = computeRoutes(POSTE, ESSOS, makeContext());
    expect(routes.length).toBeLessThanOrEqual(4);
  });

  it("marks exactly one route as recommended", () => {
    const routes = computeRoutes(POSTE, ESSOS, makeContext());
    const recommended = routes.filter((r) => r.recommended);
    expect(recommended).toHaveLength(1);
  });

  it("labels the recommended route first", () => {
    const routes = computeRoutes(POSTE, ESSOS, makeContext());
    expect(routes[0].recommended).toBe(true);
    expect(routes[0].label).toBe("Recommended");
  });

  it("sorts routes by descending profit score", () => {
    const routes = computeRoutes(POSTE, ESSOS, makeContext());
    for (let i = 1; i < routes.length; i++) {
      expect(routes[i - 1].profitScore).toBeGreaterThanOrEqual(routes[i].profitScore);
    }
  });

  it("keeps all scores within the 0-100 range", () => {
    const routes = computeRoutes(POSTE, ESSOS, makeContext());
    for (const r of routes) {
      for (const score of [r.trafficScore, r.opportunityScore, r.taxiDensityScore, r.profitScore]) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });

  it("produces a positive ETA and distance", () => {
    const routes = computeRoutes(POSTE, ESSOS, makeContext());
    for (const r of routes) {
      expect(r.etaMin).toBeGreaterThanOrEqual(1);
      expect(r.distanceKm).toBeGreaterThan(0);
    }
  });

  it("rewards low congestion with a higher traffic score", () => {
    const freeFlow = makeContext({
      traffic: ROAD_SEGMENTS.map((s) => ({
        segmentId: s.id,
        name: s.name,
        level: "free" as const,
        avgSpeedKmh: s.freeFlowKmh,
        vehicleCount: 1,
        congestionScore: 0.0,
      })),
    });
    const gridlock = makeContext({
      traffic: ROAD_SEGMENTS.map((s) => ({
        segmentId: s.id,
        name: s.name,
        level: "severe" as const,
        avgSpeedKmh: s.freeFlowKmh * 0.1,
        vehicleCount: 100,
        congestionScore: 0.95,
      })),
    });
    const freeTop = computeRoutes(POSTE, ESSOS, freeFlow)[0];
    const jamTop = computeRoutes(POSTE, ESSOS, gridlock)[0];
    expect(freeTop.trafficScore).toBeGreaterThan(jamTop.trafficScore);
  });

  it("falls back to the nearest corridor when no path connects origin and goal", () => {
    const routes = computeRoutes(POSTE, ESSOS, makeContext({ adjacency: new Map() }));
    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].via.length).toBeGreaterThan(0);
  });

  it("handles a context with no demand zones", () => {
    const routes = computeRoutes(POSTE, ESSOS, makeContext({ zones: [] }));
    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].opportunityScore).toBeGreaterThanOrEqual(0);
  });
});

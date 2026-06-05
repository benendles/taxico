import "dotenv/config";
import http from "node:http";
import express, { type Request, type Response } from "express";
import { z } from "zod";
import {
  buildAdjacency,
  computeRoutes,
  haversineM,
  ROAD_SEGMENTS,
  type AvailabilityForecast,
  type CityState,
  type LngLat,
  type RoutingContext,
} from "@taxico/shared";

const PORT = Number(process.env.PORT ?? 4004);
const TRAFFIC_URL = process.env.TRAFFIC_URL ?? "http://localhost:4002";

const adjacency = buildAdjacency(ROAD_SEGMENTS);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function availabilityLabel(per10: number): AvailabilityForecast["availability"] {
  if (per10 < 3) return "scarce";
  if (per10 < 7) return "limited";
  if (per10 < 14) return "good";
  return "abundant";
}

async function fetchState(): Promise<CityState | null> {
  try {
    const res = await fetch(`${TRAFFIC_URL}/city/state`);
    return res.ok ? ((await res.json()) as CityState) : null;
  } catch {
    return null;
  }
}

/**
 * Estimate taxi availability and wait time by combining live corridor flow with the
 * supply of free taxis near the origin. This heuristic is the seam where the documented
 * ML forecasting model (FR7) will later plug in.
 */
function computeForecast(
  origin: LngLat,
  destination: LngLat,
  originName: string,
  destinationName: string,
  state: CityState | null,
): AvailabilityForecast {
  const ctx: RoutingContext = {
    segments: ROAD_SEGMENTS,
    adjacency,
    traffic: state?.traffic ?? [],
    zones: state?.zones ?? [],
  };
  const taxis = state?.taxis ?? [];
  const rec = computeRoutes(origin, destination, ctx)[0];
  const startSeg = ROAD_SEGMENTS.find((s) => s.name === rec.via[0])!;
  const startTraffic = ctx.traffic.find((t) => t.name === rec.via[0]);

  const lengthKm = Math.max(startSeg.lengthM / 1000, 0.2);
  const speed = startTraffic?.avgSpeedKmh ?? startSeg.freeFlowKmh;
  const vehicles = startTraffic?.vehicleCount ?? 0;

  const freeNearby = taxis.filter(
    (t) => t.status !== "occupied" && haversineM([t.lng, t.lat], origin) <= 700,
  ).length;

  const throughputPer10 = (vehicles / lengthKm) * (speed / 60) * 10 * 0.12;
  const availablePer10 = Number((throughputPer10 * 0.6 + freeNearby * 0.8).toFixed(1));
  const waitMin = Number(clamp(10 / Math.max(availablePer10, 0.4), 0.5, 25).toFixed(1));

  return {
    origin: originName,
    destination: destinationName,
    via: rec.via,
    taxisPer10Min: Math.max(0, Math.round(availablePer10)),
    waitMin,
    availability: availabilityLabel(availablePer10),
    trafficLevel: startTraffic?.level ?? "free",
    etaMin: rec.etaMin,
    distanceKm: rec.distanceKm,
  };
}

const lngLat = z.tuple([z.number(), z.number()]);
const forecastSchema = z.object({
  origin: lngLat,
  destination: lngLat,
  originName: z.string().default("Origin"),
  destinationName: z.string().default("Destination"),
});

function handle(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err: unknown) =>
      res.status(400).json({ error: err instanceof Error ? err.message : "Request failed." }),
    );
  };
}

const app = express();
app.use(express.json());

app.post(
  "/forecast",
  handle(async (req, res) => {
    const input = forecastSchema.parse(req.body);
    const state = await fetchState();
    const forecast = computeForecast(
      input.origin as LngLat,
      input.destination as LngLat,
      input.originName,
      input.destinationName,
      state,
    );
    res.json({ forecast });
  }),
);

app.get("/health", (_req, res) => res.json({ status: "ok", service: "prediction" }));

http.createServer(app).listen(PORT, () => console.log(`[prediction] listening on :${PORT}`));

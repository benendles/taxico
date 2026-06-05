import "dotenv/config";
import http from "node:http";
import express, { type Request, type Response } from "express";
import { z } from "zod";
import {
  buildAdjacency,
  computeRoutes,
  createMemoryRepository,
  ROAD_SEGMENTS,
  type CityState,
  type LngLat,
  type Repository,
  type RoutingContext,
} from "@taxico/shared";

const PORT = Number(process.env.PORT ?? 4003);
const TRAFFIC_URL = process.env.TRAFFIC_URL ?? "http://localhost:4002";

const adjacency = buildAdjacency(ROAD_SEGMENTS);

interface AcceptedRoute {
  id: string;
  driver: string;
  via: string[];
  profitScore: number;
  at: number;
}
// FR6 ledger — PostgreSQL in production, in-memory here. Feeds admin analytics.
const accepted: Repository<AcceptedRoute> = createMemoryRepository<AcceptedRoute>();

/** Pull the live snapshot from the Traffic Service to score against current conditions. */
async function routingContext(): Promise<RoutingContext> {
  let traffic: CityState["traffic"] = [];
  let zones: CityState["zones"] = [];
  try {
    const res = await fetch(`${TRAFFIC_URL}/city/state`);
    if (res.ok) {
      const state = (await res.json()) as CityState;
      traffic = state.traffic;
      zones = state.zones;
    }
  } catch {
    // Traffic Service unreachable — fall back to free-flow geometry only.
  }
  return { segments: ROAD_SEGMENTS, adjacency, traffic, zones };
}

const lngLat = z.tuple([z.number(), z.number()]);
const routeSchema = z.object({ origin: lngLat, destination: lngLat });
const acceptSchema = z.object({ via: z.array(z.string()).min(1), profitScore: z.number() });

function handle(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err: unknown) => {
      const status = (err as { status?: number }).status ?? 400;
      res.status(status).json({ error: err instanceof Error ? err.message : "Request failed." });
    });
  };
}

const app = express();
app.use(express.json());

app.post(
  "/recommend",
  handle(async (req, res) => {
    const { origin, destination } = routeSchema.parse(req.body);
    const routes = computeRoutes(origin as LngLat, destination as LngLat, await routingContext());
    res.json({ routes });
  }),
);

// The gateway authorises drivers and forwards identity via x-user-* headers.
app.post("/accept", (req, res) => {
  if (req.header("x-user-role") !== "driver") {
    return res.status(403).json({ error: "Only drivers can accept routes." });
  }
  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid route payload." });
  const record = accepted.insert({
    id: "acc-" + Math.random().toString(36).slice(2, 9),
    driver: req.header("x-user-name") ?? "Driver",
    via: parsed.data.via,
    profitScore: parsed.data.profitScore,
    at: Date.now(),
  });
  res.status(201).json({ accepted: record });
});

app.get("/accepted", (_req, res) => {
  const all = accepted.all().sort((a, b) => b.at - a.at);
  res.json({ acceptedRoutes: all.slice(0, 20), acceptedCount: all.length });
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "route" }));

http.createServer(app).listen(PORT, () => console.log(`[route] listening on :${PORT}`));

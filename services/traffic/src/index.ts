import "dotenv/config";
import http from "node:http";
import express from "express";
import { Server as IOServer } from "socket.io";
import { createMemoryCache, DEMAND_ZONES, ROAD_SEGMENTS, type CityState } from "@taxico/shared";
import { simulation } from "./engine";

const PORT = Number(process.env.PORT ?? 4002);
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((s) => s.trim());

// Redis-backed in production; in-memory for the MVP. Holds the freshest snapshot so
// REST reads never block on the simulation loop.
const cache = createMemoryCache();
const SNAPSHOT_KEY = "city:state";

const app = express();
app.use(express.json());

const snapshot = (): CityState | null => cache.get<CityState>(SNAPSHOT_KEY) ?? simulation.getState();

app.get("/city/state", (_req, res) => {
  const state = snapshot();
  if (!state) return res.status(503).json({ error: "Simulation warming up." });
  res.json(state);
});

app.get("/traffic", (_req, res) => res.json(snapshot()?.traffic ?? []));
app.get("/zones", (_req, res) => res.json(snapshot()?.zones ?? []));

app.get("/geo/segments", (_req, res) => {
  res.json({
    segments: ROAD_SEGMENTS.map(({ id, name, path }) => ({ id, name, path })),
    places: DEMAND_ZONES.map(({ id, name, lng, lat }) => ({ id, name, lng, lat })),
  });
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "traffic" }));

const server = http.createServer(app);

const io = new IOServer(server, { cors: { origin: CORS_ORIGINS, methods: ["GET", "POST"] } });
io.on("connection", (socket) => {
  const state = snapshot();
  if (state) socket.emit("city:state", state);
});

// Cache every tick (TTL just over one tick) and fan out to all connected clients.
simulation.subscribe((state) => {
  cache.set(SNAPSHOT_KEY, state, 6000);
  io.emit("city:state", state);
});

simulation.start();
server.listen(PORT, () => console.log(`[traffic] listening on :${PORT} (${simulation.getSegments().length} corridors)`));

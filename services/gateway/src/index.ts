import "dotenv/config";
import http from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createProxyMiddleware, type Options } from "http-proxy-middleware";

const PORT = Number(process.env.PORT ?? 4000);
const JWT_SECRET = process.env.JWT_SECRET ?? "taxico-dev-secret-change-me";
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((s) => s.trim());

const AUTH_URL = process.env.AUTH_URL ?? "http://localhost:4001";
const TRAFFIC_URL = process.env.TRAFFIC_URL ?? "http://localhost:4002";
const ROUTE_URL = process.env.ROUTE_URL ?? "http://localhost:4003";
const PREDICTION_URL = process.env.PREDICTION_URL ?? "http://localhost:4004";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production. Refusing to start on the insecure dev fallback.");
}

interface Claims {
  sub: string;
  role: "driver" | "passenger" | "admin";
  name: string;
}
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: Claims;
    }
  }
}

/** Verify a bearer token if present; never rejects (route guards enforce access). */
function maybeAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.auth = jwt.verify(header.slice(7), JWT_SECRET) as Claims;
    } catch {
      /* invalid token → treated as anonymous */
    }
  }
  next();
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: "Authentication required." });
  next();
}

function requireRole(...roles: Claims["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "Authentication required." });
    if (!roles.includes(req.auth.role)) return res.status(403).json({ error: "You do not have access to this resource." });
    next();
  };
}

/** Forward the gateway-verified identity downstream; strip any client-supplied spoofs. */
const identityProxy = (target: string, pathRewrite: Record<string, string>): ReturnType<typeof createProxyMiddleware> => {
  const options: Options = {
    target,
    changeOrigin: true,
    pathRewrite,
    onProxyReq: (proxyReq, req: Request) => {
      proxyReq.removeHeader("x-user-id");
      proxyReq.removeHeader("x-user-role");
      proxyReq.removeHeader("x-user-name");
      if (req.auth) {
        proxyReq.setHeader("x-user-id", req.auth.sub);
        proxyReq.setHeader("x-user-role", req.auth.role);
        proxyReq.setHeader("x-user-name", req.auth.name);
      }
    },
  };
  return createProxyMiddleware(options);
};

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

const app = express();
app.use(cors({ origin: CORS_ORIGINS }));
app.use(maybeAuth);

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "gateway", at: Date.now() }));

// ── Admin aggregation: the gateway composes a view across services ────────────
app.get("/api/admin/users", requireRole("admin"), async (_req, res) => {
  const data = await getJson<{ users: unknown[] }>(`${AUTH_URL}/users`);
  res.json(data ?? { users: [] });
});

app.get("/api/admin/analytics", requireRole("admin"), async (_req, res) => {
  const [state, ledger] = await Promise.all([
    getJson<{ stats: unknown; traffic: unknown[]; zones: unknown[] }>(`${TRAFFIC_URL}/city/state`),
    getJson<{ acceptedRoutes: unknown[]; acceptedCount: number }>(`${ROUTE_URL}/accepted`),
  ]);
  res.json({
    fleet: state?.stats ?? null,
    corridors: state?.traffic ?? [],
    zones: state?.zones ?? [],
    acceptedRoutes: ledger?.acceptedRoutes ?? [],
    acceptedCount: ledger?.acceptedCount ?? 0,
  });
});

// ── Route guards on protected proxied endpoints ───────────────────────────────
app.use("/api/auth/me", requireAuth);
app.use("/api/routes/accept", requireRole("driver"));

// ── Service proxies ───────────────────────────────────────────────────────────
app.use("/api/auth", identityProxy(AUTH_URL, { "^/api/auth": "" }));
app.use(["/api/city", "/api/traffic", "/api/zones", "/api/geo"], identityProxy(TRAFFIC_URL, { "^/api": "" }));
app.use("/api/routes", identityProxy(ROUTE_URL, { "^/api/routes": "" }));
app.use("/api/forecast", identityProxy(PREDICTION_URL, { "^/api": "" }));

// ── Real-time: proxy Socket.IO (HTTP + WebSocket upgrade) to the Traffic Service ─
const wsProxy = createProxyMiddleware({ target: TRAFFIC_URL, changeOrigin: true, ws: true });
app.use("/socket.io", wsProxy);

const server = http.createServer(app);
if (wsProxy.upgrade) server.on("upgrade", wsProxy.upgrade);

server.listen(PORT, () => {
  console.log(`[gateway] listening on :${PORT}`);
  console.log(`[gateway] auth=${AUTH_URL} traffic=${TRAFFIC_URL} route=${ROUTE_URL} prediction=${PREDICTION_URL}`);
});

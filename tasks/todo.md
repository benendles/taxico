# Taxico — build plan

Scope (confirmed with the user): a **full-stack working MVP** — Next.js/TS/Tailwind web
client + Node/Express/Socket.IO API with a **Cameroon traffic/taxi simulation engine**.
Mapbox wired to `NEXT_PUBLIC_MAPBOX_TOKEN` with a live SVG schematic fallback.

## Plan

1. Scaffold the monorepo (npm workspaces, .gitignore, docker-compose) — verify: `npm install` resolves.
2. API domain types + Yaoundé corridor/zone geometry — verify: lengths compute, adjacency builds.
3. Simulation engine (movement, congestion, demand, opportunity, notifications) — verify: `getState()` returns a coherent snapshot each tick.
4. Auth (JWT/bcrypt), routing engine, forecasting service — verify: routes rank, forecast bounded.
5. Express routes + Socket.IO gateway + bootstrap — verify: API type-checks, server boots.
6. Next.js app shell, design tokens, fonts — verify: Tailwind compiles.
7. Map component (Mapbox + schematic fallback) — verify: renders with and without a token.
8. Pages: landing, auth, driver, passenger, admin — verify: each type-checks and renders.
9. Install + type-check + build both apps — verify: `npm run build` is clean.
10. README + this review.

## Review

**Delivered:** a runnable full-stack MVP in a two-app npm-workspace monorepo.

- **API** (`apps/api`) — Express + Socket.IO + a deterministic Yaoundé simulation
  engine (10 corridors, 11 demand zones, 140 taxis). Auth (JWT + bcrypt), a corridor-graph
  route engine, and an availability/wait-time forecaster. In-memory store, zero external
  services needed to run.
- **Web** (`apps/web`) — Next.js App Router + Tailwind, control-room dark theme with
  Cameroon taxi-yellow accent, Bricolage Grotesk / Hanken Grotesk / JetBrains Mono.
  Landing, auth, driver dashboard, passenger forecast and admin console. Mapbox GL with a
  live SVG schematic fallback when no token is set.

**Verification performed:**
- `npm run typecheck` — clean for both apps (one `satisfies`-inference bug fixed).
- `npm run build` — both apps build; web prerenders all 9 routes.
- API booted: `/api/health` ok; `/api/city/state` returns 140 moving taxis with coherent
  stats; login returns a JWT; `/routes/recommend` ranks options by profit (recommended ≠
  fastest, proving the multi-factor blend); `/forecast` returns bounded availability;
  `/routes/accept` records under the driver identity; `/admin/users` returns 401 without a token.
- Web booted via `next start`: `/`, `/login`, `/driver`, `/passenger`, `/admin` all return 200.

**Notes / follow-ups:**
- Mapbox needs a `pk.*` token in `apps/web/.env.local`; until then the schematic renders.
- Persistence (PostgreSQL/PostGIS, Redis) and the heavier DevOps targets are scaffolded in
  `docker-compose.yml` but intentionally not wired into the MVP runtime.
- Coordinates are approximate district positions — accurate enough to read as Yaoundé, not
  survey-grade.

---

## Phase 2 — microservices, theming & redesign

Three changes requested: split the backend into the services from the architecture
diagram (separate processes), add light/dark mode everywhere, and redesign toward a
corporate-minimal aesthetic (per /frontend-design).

### What changed
- **Microservices.** The `apps/api` monolith became `packages/shared` (domain, geo,
  routing, infra ports) + five Node processes: `gateway` (:4000), `auth` (:4001),
  `traffic` (:4002), `route` (:4003), `prediction` (:4004). The gateway is the only public
  surface — it verifies JWTs and forwards a trusted identity downstream, proxies REST, and
  passes the Socket.IO upgrade through to traffic. PostgreSQL/PostGIS and Redis are modelled
  as `Repository`/`Cache` ports with in-memory implementations.
- **Theming.** `next-themes` provider + a CSS-variable token system (`:root` light, `.dark`
  dark) wired through Tailwind, a sun/moon toggle, and a theme-aware Mapbox style swap.
- **Redesign.** Neutral surfaces + a single slate-blue accent, refined type (Schibsted
  Grotesk / Hanken Grotesk / JetBrains Mono), hairline borders, restrained micro-interactions
  (hover lifts, live pulse, staggered reveals). Replaced the bright-yellow identity.

### Verification
- `npm run typecheck` — clean across all 7 workspaces (fixed one optional `wsProxy.upgrade`).
- `npm run build` — 5 services (tsup, bundling shared) + web all build.
- Booted gateway + 4 services; smoke-tested through :4000 — login, `/auth/me` identity
  resolution, route recommendation (route svc → traffic svc), forecast (prediction svc),
  driver-only accept (401 without token), admin aggregation (403 for passenger, full data
  for admin, `acceptedCount` reflecting the ledger), and the Socket.IO handshake.
- Booted web; all routes return 200; light+dark token blocks confirmed in the shipped CSS.

### Follow-ups
- Docker images (`Dockerfile.service` + compose) are provided but not built/run here.
- Persistence/cache remain in-memory behind the `@taxico/shared` ports.

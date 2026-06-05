# Taxico

**Intelligent Traffic and Taxi Availability Prediction System for Cameroon.**

Taxico is *not* a ride-hailing app. It does not book rides or move money between
passengers and drivers. It is the **intelligence layer beneath the city's taxis** —
reading live traffic, forecasting taxi availability, and recommending the most
profitable routes in real time across Yaoundé.

- **Drivers** see live congestion, follow the highest-scoring corridor, and head toward
  the neighbourhoods where passengers are actually waiting.
- **Passengers** estimate how many taxis pass their route and how long they will wait
  before they leave the house.
- **Administrators** monitor the city — congestion, demand, fleet and accepted routes —
  from a single console.

---

## Screens

| Route | Audience | What it does |
| --- | --- | --- |
| `/` | Everyone | Landing page describing the system |
| `/login`, `/register` | Everyone | JWT authentication (FR1) |
| `/driver` | Drivers | Live map, route recommendation, opportunity zones, alerts (FR2–FR6, FR9, FR10) |
| `/passenger` | Passengers | Availability & waiting-time forecast along a chosen route (FR7, FR8) |
| `/admin` | Administrators | Corridor traffic, demand/opportunity, users, accepted-route ledger |

---

## Architecture

A microservices monorepo managed with npm workspaces. The web client talks only to the
**API Gateway**, which authenticates requests and routes them to four focused services,
forwarding Socket.IO traffic to the Traffic Service.

```
                         Next.js Web (:3000)
                                │
                        API Gateway (:4000)   JWT verify · routing · admin aggregation
        ┌───────────────┬───────┴────────┬────────────────┐
        ▼               ▼                ▼                ▼
   Auth (:4001)   Traffic (:4002)   Route (:4003)   Prediction (:4004)
                   sim + Socket.IO   recommend       forecasting
        └───────────────┴────────────────┴────────────────┘
                     PostgreSQL/PostGIS · Redis (infra ports)

taxico/
├─ packages/shared/   Domain types, Yaoundé geo data, routing engine, infra ports
├─ services/
│  ├─ gateway/        Single entry point; proxy + auth + admin aggregation + ws passthrough
│  ├─ auth/           Registration, login, JWT, user store (FR1)
│  ├─ traffic/        Simulation engine, city state, Socket.IO (FR2–FR4, FR9)
│  ├─ route/          Route recommendation + accepted-route ledger (FR5, FR6)
│  └─ prediction/     Taxi availability & wait-time forecasting (FR7, FR8)
├─ apps/web/          Next.js (App Router) + TypeScript + Tailwind + Mapbox GL
├─ Dockerfile.service Generic image for any backend service (--build-arg SERVICE=…)
└─ docker-compose.yml gateway + 4 services + web + PostgreSQL/PostGIS + Redis
```

Services share `@taxico/shared` (domain model, geo data, routing). Each is its own Node
process with its own port; the gateway is the only public surface. Auth is the JWT
authority; the gateway verifies tokens and forwards a trusted identity (`x-user-*`
headers) downstream. `Repository` (PostgreSQL/PostGIS) and `Cache` (Redis) are defined as
ports in `@taxico/shared/infra` with in-memory implementations, so the whole system runs
with no external services for the demo.

### How the intelligence works

The MVP has no real GPS feed yet, so a **deterministic simulation engine**
(`apps/api/src/sim/engine.ts`) stands in for the fleet:

- ~140 taxis move along real Yaoundé corridors (`apps/api/src/geo.ts`).
- Congestion is derived from **vehicle density and speed** per corridor, smoothed over
  time and shaped by a morning/evening **rush-hour profile** (FR4).
- **Opportunity score** for each district = `passenger density ÷ taxi density` (FR9).
- The **route engine** (`services/routing.ts`) searches the corridor graph and scores
  options on travel time, traffic, taxi saturation and opportunity (FR5).
- The **forecasting service** (`services/forecast.ts`) combines corridor flow with the
  supply of free taxis near the origin to estimate availability and wait time (FR7).
- A full city snapshot is streamed to every client over **Socket.IO** on each tick (FR2).

The target production stack (PostgreSQL/PostGIS, Redis, Docker, Kubernetes, AWS) is
captured in `docker-compose.yml`; the API uses an in-memory store so it runs with zero
external services for the demo.

---

## Getting started

### Prerequisites

- Node.js 20+
- (Optional) A Mapbox public token — without it the map renders a live SVG schematic.

### 1. Install

```bash
npm install
```

### 2. Configure environment

The services run on sensible localhost defaults, so the only thing you need to set is the
Mapbox token for the web client:

```bash
cp apps/web/.env.local.example apps/web/.env.local   # then paste your pk.* token
```

Set `NEXT_PUBLIC_MAPBOX_TOKEN` in `apps/web/.env.local`. Without it the map falls back to a
live SVG schematic. In production, set `JWT_SECRET` for the gateway and auth service (they
refuse to start on the dev fallback when `NODE_ENV=production`).

### 3. Run everything

```bash
npm run dev          # gateway + 4 services + web, all at once
```

- Web: <http://localhost:3000>
- Gateway: <http://localhost:4000> (the only public API surface)
- Services: auth :4001 · traffic :4002 · route :4003 · prediction :4004

Run just the backend with `npm run dev:services`, or the web alone with `npm run dev:web`.

The interface ships **light and dark themes** (toggle in the top bar); it defaults to dark
and respects your system preference.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Driver | `driver@taxico.cm` | `taxico-driver` |
| Passenger | `passenger@taxico.cm` | `taxico-pass` |
| Admin | `admin@taxico.cm` | `taxico-admin` |

The login screen also fills these in for you on a single click.

---

## API reference

All endpoints are prefixed with `/api`. Authenticated routes expect
`Authorization: Bearer <token>`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | — | Register a driver or passenger |
| `POST` | `/auth/login` | — | Obtain a JWT |
| `GET` | `/auth/me` | any | Current identity |
| `GET` | `/geo/segments` | — | Corridor geometry + named places |
| `GET` | `/city/state` | — | Latest city snapshot |
| `GET` | `/traffic`, `/zones` | — | Live traffic / demand zones |
| `POST` | `/routes/recommend` | — | Ranked route options for an origin/destination |
| `POST` | `/routes/accept` | driver | Record an accepted route (FR6) |
| `POST` | `/forecast` | — | Availability & wait-time forecast (FR7/FR8) |
| `GET` | `/admin/users` | admin | Registered users |
| `GET` | `/admin/analytics` | admin | Fleet stats, corridors, zones, accepted routes |

Socket.IO emits `city:state` (the full `CityState` snapshot) on connect and on every tick.

---

## Available scripts

| Command | Effect |
| --- | --- |
| `npm run dev` | Run the gateway, all four services and the web client concurrently |
| `npm run dev:services` | Run only the backend (gateway + 4 services) |
| `npm run build` | Build every service (tsup) and the web app (next build) |
| `npm run typecheck` | Type-check every workspace |

---

## Roadmap

The simulation's heuristics are deliberately the seams where the documented future
work plugs in: ML demand forecasting, learned route optimisation, driver revenue
prediction, weather-aware recommendations, and integration with municipal systems.

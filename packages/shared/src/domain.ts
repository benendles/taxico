/**
 * Core domain model for Taxico.
 *
 * Coordinates follow the GeoJSON convention: [longitude, latitude].
 * Distances are in metres unless a field name says otherwise; speeds are km/h.
 */

export type LngLat = [number, number];

export type TrafficLevel = "free" | "moderate" | "heavy" | "severe";

export type TaxiStatus = "cruising" | "occupied" | "idle";

/** A directed road corridor the simulation moves taxis along. */
export interface RoadSegment {
  id: string;
  name: string;
  /** Ordered polyline of [lng, lat] points describing the corridor geometry. */
  path: LngLat[];
  /** Nominal free-flow speed for this corridor in km/h. */
  freeFlowKmh: number;
  /** Total polyline length in metres (precomputed at load). */
  lengthM: number;
}

export interface Taxi {
  id: string;
  plate: string;
  lng: number;
  lat: number;
  /** Heading in degrees, 0 = north, clockwise. */
  heading: number;
  speedKmh: number;
  status: TaxiStatus;
  segmentId: string;
}

/** Live, aggregated traffic state for one corridor. */
export interface SegmentTraffic {
  segmentId: string;
  name: string;
  level: TrafficLevel;
  avgSpeedKmh: number;
  /** Taxis currently on the corridor. */
  vehicleCount: number;
  /** 0 (free) → 1 (gridlock). */
  congestionScore: number;
}

/** A neighbourhood with measurable passenger demand and taxi supply. */
export interface DemandZone {
  id: string;
  name: string;
  lng: number;
  lat: number;
  radiusM: number;
  passengerDensity: number;
  taxiDensity: number;
  /** passengerDensity / taxiDensity — higher means more profitable for drivers. */
  opportunityScore: number;
}

export interface RouteOption {
  id: string;
  label: string;
  /** Names of the corridors traversed, in order. */
  via: string[];
  path: LngLat[];
  distanceKm: number;
  etaMin: number;
  /** 0 (gridlock) → 100 (free flowing). */
  trafficScore: number;
  /** 0 → 100, demand relative to supply along the route. */
  opportunityScore: number;
  /** 0 → 100, how saturated the route is with other taxis (lower is better). */
  taxiDensityScore: number;
  /** Weighted blend used to rank options. */
  profitScore: number;
  recommended: boolean;
}

export interface AvailabilityForecast {
  origin: string;
  destination: string;
  via: string[];
  /** Expected taxis passing the origin per 10 minutes. */
  taxisPer10Min: number;
  /** Estimated passenger waiting time in minutes. */
  waitMin: number;
  availability: "scarce" | "limited" | "good" | "abundant";
  trafficLevel: TrafficLevel;
  etaMin: number;
  distanceKm: number;
}

export type NotificationKind = "congestion" | "route" | "opportunity";

export interface DriverNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Epoch milliseconds. */
  at: number;
  segmentId?: string;
  zoneId?: string;
}

/** Full snapshot streamed to connected clients on each simulation tick. */
export interface CityState {
  at: number;
  taxis: Taxi[];
  traffic: SegmentTraffic[];
  zones: DemandZone[];
  notifications: DriverNotification[];
  stats: {
    activeTaxis: number;
    occupiedTaxis: number;
    congestedCorridors: number;
    avgCitySpeedKmh: number;
    topOpportunityZone: string;
  };
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: "driver" | "passenger" | "admin";
  createdAt: number;
}

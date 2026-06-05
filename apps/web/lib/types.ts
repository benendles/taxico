// Client-side mirror of the API domain model (apps/api/src/domain.ts).
// Kept in sync manually; the two apps deliberately have no build-time coupling.

export type LngLat = [number, number];
export type TrafficLevel = "free" | "moderate" | "heavy" | "severe";
export type TaxiStatus = "cruising" | "occupied" | "idle";

export interface Taxi {
  id: string;
  plate: string;
  lng: number;
  lat: number;
  heading: number;
  speedKmh: number;
  status: TaxiStatus;
  segmentId: string;
}

export interface SegmentTraffic {
  segmentId: string;
  name: string;
  level: TrafficLevel;
  avgSpeedKmh: number;
  vehicleCount: number;
  congestionScore: number;
}

export interface DemandZone {
  id: string;
  name: string;
  lng: number;
  lat: number;
  radiusM: number;
  passengerDensity: number;
  taxiDensity: number;
  opportunityScore: number;
}

export interface RouteOption {
  id: string;
  label: string;
  via: string[];
  path: LngLat[];
  distanceKm: number;
  etaMin: number;
  trafficScore: number;
  opportunityScore: number;
  taxiDensityScore: number;
  profitScore: number;
  recommended: boolean;
}

export interface AvailabilityForecast {
  origin: string;
  destination: string;
  via: string[];
  taxisPer10Min: number;
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
  at: number;
  segmentId?: string;
  zoneId?: string;
}

export interface CityStats {
  activeTaxis: number;
  occupiedTaxis: number;
  congestedCorridors: number;
  avgCitySpeedKmh: number;
  topOpportunityZone: string;
}

export interface CityState {
  at: number;
  taxis: Taxi[];
  traffic: SegmentTraffic[];
  zones: DemandZone[];
  notifications: DriverNotification[];
  stats: CityStats;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  role: "driver" | "passenger" | "admin";
  createdAt?: number;
}

export interface Place {
  id: string;
  name: string;
  lng: number;
  lat: number;
}

export interface Corridor {
  id: string;
  name: string;
  path: LngLat[];
}

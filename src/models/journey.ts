import type { TransportMode } from './transport';

/** [longitude, latitude] — GeoJSON order. */
export type LngLat = [number, number];

export interface Place {
  id: string;
  /** Short name used on screen, e.g. "Đà Nẵng". */
  name: string;
  /** Longer disambiguating label, e.g. "Đà Nẵng, Việt Nam". */
  displayName: string;
  latitude: number;
  longitude: number;
}

export interface Route {
  /** Simplified polyline, [lng, lat] pairs. */
  coordinates: LngLat[];
  /** Metres. */
  distance: number;
  /** Seconds. */
  estimatedDuration: number;
  /** True when the geometry is an approximation rather than a real network route (e.g. train). */
  approximate?: boolean;
  /** Which provider produced the geometry — useful for debugging / attribution. */
  source: string;
}

export interface JourneySegment {
  id: string;
  origin: Place;
  destination: Place;
  transport: TransportMode;
  /** "HH:MM" local clock time, optional. */
  startTime: string | null;
  endTime: string | null;
  route: Route | null;
}

export type CameraMode = 'static' | 'follow' | 'cinematic';

export interface OverlaySettings {
  intro: boolean;
  outro: boolean;
  /** Small persistent caption: ORIGIN → DESTINATION, transport, distance, clock. */
  caption: boolean;
  /** Place-name labels beside the markers. */
  labels: boolean;
}

export interface VideoSettings {
  /** Seconds. */
  duration: number;
  fps: 30 | 60;
  width: number;
  height: number;
  cameraMode: CameraMode;
  mapStyle: string;
  routeColor: string;
  overlays: OverlaySettings;
}

export interface Journey {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /**
   * The stops the user picked, in order. Segments are derived pairwise from these
   * (stop[i] → stop[i+1]); `null` marks a stop that hasn't been chosen yet.
   */
  stops: (Place | null)[];
  segments: JourneySegment[];
  videoSettings: VideoSettings;
}

export const PROJECT_FILE_VERSION = 1;

export interface ProjectFile {
  app: 'vet';
  version: number;
  journey: Journey;
}

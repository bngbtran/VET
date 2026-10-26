import { DEFAULT_MAP_STYLE } from '../providers/maps/styles';
import { createId } from '../utils/id';
import type { Journey, JourneySegment, Place, VideoSettings } from './journey';
import type { TransportMode } from './transport';
import { ROUTE_COLORS } from './video';

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  duration: 20,
  fps: 30,
  width: 1920,
  height: 1080,
  cameraMode: 'cinematic',
  mapStyle: DEFAULT_MAP_STYLE,
  routeColor: ROUTE_COLORS[0]!.value,
  overlays: { intro: true, outro: true, caption: true, labels: true },
};

export function createJourney(): Journey {
  const now = Date.now();
  return {
    id: createId('j'),
    name: 'Untitled journey',
    createdAt: now,
    updatedAt: now,
    stops: [null, null],
    segments: [],
    videoSettings: structuredClone(DEFAULT_VIDEO_SETTINGS),
  };
}

const samePlace = (a: Place, b: Place) => a.latitude === b.latitude && a.longitude === b.longitude;

/**
 * Rebuild segments from the stop list. A segment exists between two consecutive chosen stops;
 * an existing segment keeps its transport, times and route when its endpoints are unchanged.
 * `transports[i]` is the mode chosen for the gap after stop i.
 */
export function deriveSegments(
  stops: (Place | null)[],
  transports: TransportMode[],
  previous: JourneySegment[],
): JourneySegment[] {
  const segments: JourneySegment[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const origin = stops[i];
    const destination = stops[i + 1];
    if (!origin || !destination) continue;
    const transport = transports[i] ?? 'car';
    const prev = previous.find(
      (s) => samePlace(s.origin, origin) && samePlace(s.destination, destination),
    );
    segments.push({
      id: prev?.id ?? createId('s'),
      origin,
      destination,
      transport,
      startTime: prev?.startTime ?? null,
      endTime: prev?.endTime ?? null,
      route: prev && prev.transport === transport ? prev.route : null,
    });
  }
  return segments;
}

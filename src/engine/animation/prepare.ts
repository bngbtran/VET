import type { Journey, JourneySegment, LngLat, Place, VideoSettings } from '../../models/journey';
import type { TransportMode } from '../../models/transport';
import { type CameraState, fitBoundsCamera, zoomForGroundWidth } from '../camera/camera';
import { boundsOf, getBearing } from '../route/geo';
import { calculateRouteDistances, type MeasuredRoute } from '../route/measure';
import { parseClock } from './clock';

/** A routed segment with everything the per-frame functions need precomputed. */
export interface PreparedSegment {
  id: string;
  origin: Place;
  destination: Place;
  transport: TransportMode;
  measured: MeasuredRoute;
  /** Distance reported by the routing provider (may differ slightly from the simplified line). */
  distance: number;
  approximate: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
  /** Ground width (m) the follow camera keeps in view. */
  viewWidth: number;
  followZoom: number;
  /** Origin → destination bearing, used to orient the cinematic camera. */
  overallBearing: number;
  /** Relative share of travel time in the video. */
  weight: number;
}

export interface PreparedJourney {
  segments: PreparedSegment[];
  /** All stops the user has chosen, including ones not yet connected by a route. */
  places: Place[];
  /** Camera that frames the whole journey. */
  overview: CameraState;
  settings: VideoSettings;
}

const placeLngLat = (p: Place): LngLat => [p.longitude, p.latitude];

/** Estimated travel time; drives how much of the video each segment gets. */
function travelMinutes(seg: JourneySegment): number {
  return Math.max(1, (seg.route?.estimatedDuration ?? 600) / 60);
}

export function prepareJourney(journey: Journey): PreparedJourney {
  const segments: PreparedSegment[] = [];
  for (const seg of journey.segments) {
    if (!seg.route || seg.route.coordinates.length < 2) continue;
    const measured = calculateRouteDistances(seg.route.coordinates);
    const midLat = (seg.origin.latitude + seg.destination.latitude) / 2;
    const viewWidth = Math.max(1_200, Math.min(2_500_000, measured.total * 0.3));
    const start = parseClock(seg.startTime);
    const end = parseClock(seg.endTime);
    segments.push({
      id: seg.id,
      origin: seg.origin,
      destination: seg.destination,
      transport: seg.transport,
      measured,
      distance: seg.route.distance,
      approximate: !!seg.route.approximate,
      startMinutes: start,
      endMinutes: start !== null && end !== null && end < start ? end + 24 * 60 : end,
      viewWidth,
      followZoom: zoomForGroundWidth(viewWidth, midLat),
      overallBearing: getBearing(placeLngLat(seg.origin), placeLngLat(seg.destination)),
      // sqrt keeps a 15-minute walk visible next to a 12-hour train ride.
      weight: Math.sqrt(travelMinutes(seg)),
    });
  }

  const places = journey.stops.filter((p): p is Place => p !== null);
  const points: LngLat[] = places.map(placeLngLat);
  for (const s of segments) points.push(...s.measured.coordinates);
  const bounds = boundsOf(points);
  const overview: CameraState = bounds
    ? fitBoundsCamera(bounds, 0.14, places.length === 1 && segments.length === 0 ? 11 : 14)
    : { center: [107.9, 16.2], zoom: 5, bearing: 0, pitch: 0 }; // central Việt Nam

  return { segments, places, overview, settings: journey.videoSettings };
}

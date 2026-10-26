import type { CameraMode } from '../../models/journey';
import { easeInOutCubic, easeInOutSine, remap01 } from '../animation/easing';
import type { PreparedJourney, PreparedSegment } from '../animation/prepare';
import type { Phase } from '../animation/timeline';
import { angleDelta } from '../route/geo';
import { getPositionAtDistance, getSmoothedBearing } from '../route/measure';
import { type CameraState, interpolateCamera } from './camera';

const CINEMATIC_PITCH = 50;

/** Camera while travelling segment `seg` at `distance` metres along it. */
export function travelCamera(seg: PreparedSegment, distance: number, mode: CameraMode): CameraState {
  if (mode === 'follow') {
    return { center: getPositionAtDistance(seg.measured, distance), zoom: seg.followZoom, bearing: 0, pitch: 0 };
  }
  // Cinematic: frame slightly ahead of the vehicle, pitched, rotated part-way toward the
  // direction of travel. The constant half-turn toward the overall heading plus a small
  // sin-shaped local sway is continuous everywhere — no flips when the road doubles back.
  const lead = seg.viewWidth * 0.06;
  const center = getPositionAtDistance(seg.measured, distance + lead);
  const local = getSmoothedBearing(seg.measured, distance, seg.viewWidth * 0.75);
  const base = angleDelta(0, seg.overallBearing) * 0.5;
  const sway = 18 * Math.sin((angleDelta(seg.overallBearing, local) * Math.PI) / 180);
  return {
    center,
    // Pitch reveals more ground towards the horizon; pull in a touch to compensate.
    zoom: seg.followZoom + 0.25,
    bearing: (base + sway + 360) % 360,
    pitch: CINEMATIC_PITCH,
  };
}

const segmentEnd = (seg: PreparedSegment, mode: CameraMode) => travelCamera(seg, seg.measured.total, mode);
const segmentStart = (seg: PreparedSegment, mode: CameraMode) => travelCamera(seg, 0, mode);

export function getCamera(journey: PreparedJourney, phase: Phase, time: number, distance: number): CameraState {
  const mode = journey.settings.cameraMode;
  const { segments, overview } = journey;
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (mode === 'static' || !first || !last) return overview;

  const r = remap01(time, phase.start, phase.end);

  switch (phase.kind) {
    case 'travel':
      return travelCamera(segments[phase.segment]!, distance, mode);

    case 'hold': {
      const from = segmentEnd(segments[phase.segment]!, mode);
      const to = segmentStart(segments[phase.segment + 1]!, mode);
      return interpolateCamera(from, to, easeInOutCubic(r));
    }

    case 'intro': {
      const start = segmentStart(first, mode);
      if (mode === 'follow') return start;
      // Establishing shot on the origin: low pitch, closer in, slowly pushing forward, then
      // gliding into the travelling camera.
      const origin: CameraState = {
        center: [first.origin.longitude, first.origin.latitude],
        zoom: first.followZoom + 1.1,
        bearing: (start.bearing - 14 + 360) % 360,
        pitch: 22,
      };
      const pushed: CameraState = { ...origin, zoom: origin.zoom + 0.25, bearing: (origin.bearing + 5) % 360, pitch: 28 };
      const split = 0.35;
      return r < split
        ? interpolateCamera(origin, pushed, easeInOutSine(r / split))
        : interpolateCamera(pushed, start, easeInOutCubic((r - split) / (1 - split)));
    }

    case 'outro': {
      const end = segmentEnd(last, mode);
      if (mode === 'follow') return end;
      // Arrival: settle onto the destination, hold, then pull back to reveal the whole Vệt.
      const arrival: CameraState = {
        center: [last.destination.longitude, last.destination.latitude],
        zoom: last.followZoom + 0.6,
        bearing: end.bearing,
        pitch: 35,
      };
      const length = phase.end - phase.start;
      if (length < 2) return interpolateCamera(end, arrival, easeInOutSine(r));
      if (r < 0.4) return interpolateCamera(end, arrival, easeInOutSine(r / 0.4));
      if (r < 0.55) return arrival;
      return interpolateCamera(arrival, overview, easeInOutCubic((r - 0.55) / 0.45));
    }
  }
}

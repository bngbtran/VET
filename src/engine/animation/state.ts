import type { LngLat, Place } from '../../models/journey';
import { TRANSPORT, type TransportMode } from '../../models/transport';
import { type CameraState } from '../camera/camera';
import { getCamera } from '../camera/director';
import { getPositionAtDistance, getRouteUntilDistance, getSmoothedBearing } from '../route/measure';
import { formatClock } from './clock';
import { clamp01, lerp, remap01, smoothstep, travelEase } from './easing';
import type { PreparedJourney, PreparedSegment } from './prepare';
import { buildTimeline, phaseAt, type Phase, type Timeline } from './timeline';

export interface VehicleState {
  position: LngLat;
  /** Degrees clockwise from north; 0 for modes whose icon doesn't rotate. */
  bearing: number;
  transport: TransportMode;
}

export interface MarkerState {
  id: string;
  position: LngLat;
  name: string;
  role: 'origin' | 'stop' | 'destination';
  reached: boolean;
  /** Colour of the leg that arrives here (the first leg's, for the origin). */
  color: string;
}

export interface TitleCard {
  kicker: string | null;
  name: string;
  coordinates: string;
  /** Summary line under the coordinates, e.g. total distance on the arrival card. */
  stat: { label: string; value: string } | null;
  opacity: number;
  size: 'large' | 'small';
}

export interface CaptionState {
  route: string;
  detail: string;
  clock: string | null;
  progress: number;
  opacity: number;
}

export interface OverlayState {
  title: TitleCard | null;
  caption: CaptionState | null;
  labels: boolean;
}

export interface AnimationState {
  time: number;
  duration: number;
  /** time / duration, clamped to [0, 1]. */
  progress: number;
  phase: Phase['kind'];
  /** Index of the active prepared segment, or -1 when the journey has no routes. */
  segmentIndex: number;
  /** Fraction of the active segment's distance already travelled (eased). */
  segmentProgress: number;
  vehicle: VehicleState | null;
  /** The Vệt: one polyline per segment that has been (partly) travelled. */
  visibleRoute: LngLat[][];
  /** Colour of each visibleRoute line (each leg can have its own). */
  routeColors: string[];
  /** Colour of the active leg — vehicle halo, titles and caption use it. */
  accent: string;
  markers: MarkerState[];
  camera: CameraState;
  overlay: OverlayState;
}

/** Everything the per-frame function needs, computed once per journey/duration change. */
export interface AnimationModel {
  journey: PreparedJourney;
  timeline: Timeline;
}

export function createAnimationModel(journey: PreparedJourney): AnimationModel {
  return { journey, timeline: buildTimeline(journey, journey.settings.duration) };
}

const vehicleBearingWindow = (seg: PreparedSegment) => Math.max(40, Math.min(1_500, seg.measured.total * 0.004));

function vehicleAt(seg: PreparedSegment, distance: number): VehicleState {
  return {
    position: getPositionAtDistance(seg.measured, distance),
    bearing: TRANSPORT[seg.transport].rotates ? getSmoothedBearing(seg.measured, distance, vehicleBearingWindow(seg)) : 0,
    transport: seg.transport,
  };
}

export function formatCoordinates(p: Place): string {
  const lat = `${Math.abs(p.latitude).toFixed(4)}° ${p.latitude >= 0 ? 'N' : 'S'}`;
  const lng = `${Math.abs(p.longitude).toFixed(4)}° ${p.longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}   ${lng}`;
}

export function formatDistance(meters: number): string {
  const km = meters / 1000;
  if (km >= 10) return `${Math.round(km).toLocaleString('en-US')} KM`;
  if (km >= 1) return `${km.toFixed(1)} KM`;
  return `${Math.round(meters)} M`;
}

const upper = (s: string) => s.toLocaleUpperCase('vi');

/** Fade in over [a, b], fade out over [c, d]. */
function envelope(t: number, a: number, b: number, c: number, d: number) {
  return smoothstep(remap01(t, a, b)) * (1 - smoothstep(remap01(t, c, d)));
}

function clockAt(seg: PreparedSegment, fraction: number): number | null {
  if (seg.startMinutes === null) return null;
  if (seg.endMinutes === null) return fraction <= 0 ? seg.startMinutes : null;
  return lerp(seg.startMinutes, seg.endMinutes, fraction);
}

const withDate = (text: string, date: string | null) => (date ? `${text} · ${date}` : text);

/** "02/2026" if every leg shares a date, "02/2026 → 05/2026" if they differ (first to last). */
function dateSpan(segs: PreparedSegment[]): string | null {
  const dates = segs.map((s) => s.date).filter((d): d is string => d !== null);
  if (dates.length === 0) return null;
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  return first === last ? first : `${first} → ${last}`;
}

/** Clock during a stop: runs from arrival to the next departure (which may be the next day). */
function holdClock(arrive: number | null, depart: number | null, r: number): number | null {
  if (arrive === null || depart === null) return arrive ?? depart;
  let next = depart;
  while (next < arrive) next += 1440;
  return lerp(arrive, next, r);
}

/**
 * The deterministic heart of Vệt: the same model and time always produce the same frame.
 * Preview playback, seeking and video export all go through this one function.
 */
export function getAnimationState(model: AnimationModel, rawTime: number): AnimationState {
  const { journey, timeline } = model;
  const duration = timeline.duration;
  const time = Math.max(0, Math.min(duration, rawTime));
  const progress = duration > 0 ? clamp01(time / duration) : 0;
  const phase = phaseAt(timeline, time);
  const segs = journey.segments;
  const { overlays } = journey.settings;

  if (segs.length === 0) {
    return {
      time,
      duration,
      progress,
      phase: phase.kind,
      segmentIndex: -1,
      segmentProgress: 0,
      vehicle: null,
      visibleRoute: [],
      routeColors: [],
      accent: journey.settings.routeColor,
      markers: journey.places.map((p, i) => ({
        id: p.id + i,
        position: [p.longitude, p.latitude],
        name: p.name,
        role: i === 0 ? 'origin' : 'destination',
        reached: i === 0,
        color: journey.settings.routeColor,
      })),
      camera: journey.overview,
      overlay: { title: null, caption: null, labels: overlays.labels },
    };
  }

  // Which segment is active, and how far along it (in metres) is the vehicle?
  let segmentIndex = 0;
  let fraction = 0;
  switch (phase.kind) {
    case 'intro':
      break;
    case 'travel':
      segmentIndex = phase.segment;
      fraction = travelEase(remap01(time, phase.start, phase.end));
      break;
    case 'hold': {
      // The vehicle swaps to the next transport halfway through the stop.
      const r = remap01(time, phase.start, phase.end);
      segmentIndex = r < 0.5 ? phase.segment : phase.segment + 1;
      fraction = r < 0.5 ? 1 : 0;
      break;
    }
    case 'outro':
      segmentIndex = segs.length - 1;
      fraction = 1;
      break;
  }
  const seg = segs[segmentIndex]!;
  const distance = seg.measured.total * fraction;

  const visibleRoute: LngLat[][] = [];
  const routeColors: string[] = [];
  for (let i = 0; i < segmentIndex; i++) {
    visibleRoute.push(segs[i]!.measured.coordinates);
    routeColors.push(segs[i]!.color);
  }
  const partial = getRouteUntilDistance(seg.measured, distance);
  if (partial.length >= 2) {
    visibleRoute.push(partial);
    routeColors.push(seg.color);
  }

  const markers: MarkerState[] = [
    { id: `${segs[0]!.id}:o`, position: [segs[0]!.origin.longitude, segs[0]!.origin.latitude], name: segs[0]!.origin.name, role: 'origin', reached: true, color: segs[0]!.color },
    ...segs.map((s, i): MarkerState => ({
      id: `${s.id}:d`,
      position: [s.destination.longitude, s.destination.latitude],
      name: s.destination.name,
      role: i === segs.length - 1 ? 'destination' : 'stop',
      reached: i < segmentIndex || (i === segmentIndex && fraction >= 1),
      color: s.color,
    })),
  ];

  // ── Overlays ────────────────────────────────────────────────────────────────
  const intro = timeline.phases[0]!;
  const outro = timeline.phases[timeline.phases.length - 1]!;
  let title: TitleCard | null = null;
  if (phase.kind === 'intro' || (time < intro.end + 0.4 && overlays.intro)) {
    if (overlays.intro) {
      const fade = Math.min(0.5, (intro.end - intro.start) * 0.3);
      const origin = segs[0]!.origin;
      title = {
        kicker: segs[0]!.date,
        name: upper(origin.name),
        coordinates: formatCoordinates(origin),
        stat: null,
        opacity: envelope(time, 0.05, 0.05 + fade, intro.end - fade, intro.end + 0.4),
        size: 'large',
      };
    }
  } else if (phase.kind === 'hold') {
    const stop = segs[phase.segment]!.destination;
    title = {
      kicker: withDate(`${TRANSPORT[segs[phase.segment + 1]!.transport].label.toUpperCase()} NEXT`, segs[phase.segment + 1]!.date),
      name: upper(stop.name),
      coordinates: formatCoordinates(stop),
      stat: null,
      opacity: envelope(time, phase.start, phase.start + 0.25, phase.end - 0.25, phase.end),
      size: 'small',
    };
  } else if (phase.kind === 'outro' && overlays.outro) {
    const dest = segs[segs.length - 1]!.destination;
    const len = outro.end - outro.start;
    title = {
      kicker: withDate('JOURNEY COMPLETE', dateSpan(segs)),
      name: upper(dest.name),
      coordinates: formatCoordinates(dest),
      stat: { label: 'TOTAL DISTANCE', value: formatDistance(journey.totalDistance) },
      opacity: smoothstep(remap01(time, outro.start + len * 0.2, outro.start + len * 0.45)),
      size: 'large',
    };
  }
  if (title && title.opacity <= 0.001) title = null;

  let caption: CaptionState | null = null;
  if (overlays.caption) {
    let minutes = clockAt(seg, fraction);
    if (phase.kind === 'hold') {
      const r = remap01(time, phase.start, phase.end);
      minutes = holdClock(segs[phase.segment]!.endMinutes, segs[phase.segment + 1]!.startMinutes, r);
    }
    caption = {
      route: `${upper(seg.origin.name)} → ${upper(seg.destination.name)}`,
      detail: withDate(`${TRANSPORT[seg.transport].label.toUpperCase()} · ${formatDistance(seg.distance)}${seg.approximate ? ' · APPROX.' : ''}`, seg.date),
      clock: minutes === null ? null : formatClock(minutes),
      progress,
      opacity: overlays.intro ? smoothstep(remap01(time, intro.end - 0.3, intro.end + 0.5)) : 1,
    };
  }

  return {
    time,
    duration,
    progress,
    phase: phase.kind,
    segmentIndex,
    segmentProgress: fraction,
    vehicle: vehicleAt(seg, distance),
    visibleRoute,
    routeColors,
    accent: seg.color,
    markers,
    camera: getCamera(journey, phase, time, distance),
    overlay: { title, caption, labels: overlays.labels },
  };
}

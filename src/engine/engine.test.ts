import { describe, expect, it } from 'vitest';
import type { Journey, LngLat, Place } from '../models/journey';
import { createJourney } from '../models/factory';
import { createAnimationModel, getAnimationState } from './animation/state';
import { prepareJourney } from './animation/prepare';
import { buildTimeline } from './animation/timeline';
import { fitBoundsCamera, interpolateCamera, zoomForGroundWidth } from './camera/camera';
import { greatCirclePath, haversineDistance } from './route/geo';
import {
  calculateRouteDistances,
  getPositionAtDistance,
  getRouteUntilDistance,
  getSmoothedBearing,
} from './route/measure';
import { simplifyLine } from './route/simplify';

const place = (name: string, latitude: number, longitude: number): Place => ({
  id: name,
  name,
  displayName: name,
  latitude,
  longitude,
});

const DA_NANG = place('Đà Nẵng', 16.0544, 108.2022);
const HUE = place('Huế', 16.4637, 107.5909);
const HANOI = place('Hà Nội', 21.0285, 105.8542);

function journeyWith(coordinatesList: LngLat[][], stops: Place[]): Journey {
  const j = createJourney();
  j.stops = stops;
  j.segments = coordinatesList.map((coordinates, i) => ({
    id: `s${i}`,
    origin: stops[i]!,
    destination: stops[i + 1]!,
    transport: i === 0 ? 'car' : 'train',
    startTime: '08:00',
    endTime: '10:30',
    route: { coordinates, distance: calculateRouteDistances(coordinates).total, estimatedDuration: 9000, source: 'test' },
  }));
  return j;
}

describe('route measurement', () => {
  // Unevenly spaced: one long hop, then many tiny ones.
  const uneven: LngLat[] = [
    [0, 0],
    [1, 0],
    [1.01, 0],
    [1.02, 0],
    [1.03, 0],
    [1.04, 0],
  ];
  const route = calculateRouteDistances(uneven);

  it('accumulates distance', () => {
    expect(route.cumulative[0]).toBe(0);
    expect(route.total).toBeCloseTo(haversineDistance([0, 0], [1.04, 0]), 0);
  });

  it('moves at constant speed regardless of vertex spacing', () => {
    // Halfway by distance is inside the first (long) hop, not at vertex index 2–3.
    const half = getPositionAtDistance(route, route.total / 2);
    expect(half[0]).toBeCloseTo(0.52, 2);
  });

  it('clamps outside the route', () => {
    expect(getPositionAtDistance(route, -5)).toEqual([0, 0]);
    expect(getPositionAtDistance(route, route.total * 2)).toEqual([1.04, 0]);
  });

  it('cuts the visible Vệt exactly at the vehicle', () => {
    expect(getRouteUntilDistance(route, 0)).toEqual([]);
    const part = getRouteUntilDistance(route, route.total * 0.25);
    expect(part[0]).toEqual([0, 0]);
    expect(part[part.length - 1]![0]).toBeCloseTo(0.26, 2);
    expect(getRouteUntilDistance(route, route.total)).toHaveLength(uneven.length);
  });

  it('computes bearings', () => {
    expect(getSmoothedBearing(route, route.total / 2, 100)).toBeCloseTo(90, 1);
    const north = calculateRouteDistances([
      [0, 0],
      [0, 1],
    ]);
    expect(getSmoothedBearing(north, 1000, 100)).toBeCloseTo(0, 5);
  });
});

describe('geometry helpers', () => {
  it('simplifies without losing the ends', () => {
    const wiggly: LngLat[] = Array.from({ length: 500 }, (_, i) => [i * 0.001, Math.sin(i) * 1e-7]);
    const out = simplifyLine(wiggly, 4);
    expect(out.length).toBeLessThan(10);
    expect(out[0]).toEqual(wiggly[0]);
    expect(out[out.length - 1]).toEqual(wiggly[wiggly.length - 1]);
  });

  it('builds great-circle paths that start and end on the endpoints', () => {
    const path = greatCirclePath([105.85, 21.03], [139.69, 35.68], 64);
    expect(path).toHaveLength(65);
    expect(path[0]![0]).toBeCloseTo(105.85, 6);
    expect(path[64]![1]).toBeCloseTo(35.68, 6);
  });

  it('keeps longitudes continuous across the antimeridian', () => {
    const path = greatCirclePath([139.69, 35.68], [-122.42, 37.77], 64);
    for (let i = 1; i < path.length; i++) expect(Math.abs(path[i]![0] - path[i - 1]![0])).toBeLessThan(10);
  });
});

describe('camera', () => {
  it('fits bounds around the centre', () => {
    const cam = fitBoundsCamera({ west: 107.5, south: 16, east: 108.3, north: 16.5 });
    expect(cam.center[0]).toBeCloseTo(107.9, 3);
    expect(cam.zoom).toBeGreaterThan(7);
    expect(cam.zoom).toBeLessThan(11);
  });

  it('interpolates continuously and hits both ends', () => {
    const a = { center: [108.2, 16.05] as LngLat, zoom: 13, bearing: 350, pitch: 0 };
    const b = { center: [107.6, 16.46] as LngLat, zoom: 12, bearing: 10, pitch: 50 };
    expect(interpolateCamera(a, b, 0)).toEqual(a);
    expect(interpolateCamera(a, b, 1)).toEqual(b);
    const mid = interpolateCamera(a, b, 0.5);
    // A fly arcs out: mid-flight zoom is below both endpoints.
    expect(mid.zoom).toBeLessThan(12);
    // Bearing takes the short way round through north.
    expect(mid.bearing < 20 || mid.bearing > 340).toBe(true);
    let prev = a;
    for (let t = 0.01; t <= 1; t += 0.01) {
      const c = interpolateCamera(a, b, t);
      expect(Math.abs(c.zoom - prev.zoom)).toBeLessThan(0.2);
      prev = c;
    }
  });

  it('zooms out for wider ground', () => {
    expect(zoomForGroundWidth(30_000, 16)).toBeGreaterThan(zoomForGroundWidth(300_000, 16));
  });
});

describe('animation state', () => {
  const coords = Array.from({ length: 50 }, (_, i): LngLat => [
    108.2022 + (107.5909 - 108.2022) * (i / 49),
    16.0544 + (16.4637 - 16.0544) * (i / 49) + Math.sin(i / 5) * 0.01,
  ]);
  coords[0] = [DA_NANG.longitude, DA_NANG.latitude];
  coords[49] = [HUE.longitude, HUE.latitude];
  const journey = journeyWith([coords], [DA_NANG, HUE]);
  const model = createAnimationModel(prepareJourney(journey));

  it('is deterministic', () => {
    for (const t of [0, 3.3, 10, 19.97]) {
      expect(getAnimationState(model, t)).toEqual(getAnimationState(model, t));
    }
  });

  it('draws nothing at the start and everything at the end', () => {
    const start = getAnimationState(model, 0);
    expect(start.visibleRoute).toEqual([]);
    expect(start.vehicle!.position).toEqual(coords[0]);
    const end = getAnimationState(model, 20);
    expect(end.progress).toBe(1);
    expect(end.visibleRoute[0]).toHaveLength(coords.length);
    expect(end.vehicle!.position).toEqual(coords[49]);
    expect(end.markers.every((m) => m.reached)).toBe(true);
  });

  it('advances monotonically and smoothly', () => {
    let prevFraction = -1;
    let prevCam = getAnimationState(model, 0).camera;
    for (let frame = 0; frame < 600; frame++) {
      const s = getAnimationState(model, frame / 30);
      expect(s.segmentProgress).toBeGreaterThanOrEqual(prevFraction);
      prevFraction = s.segmentProgress;
      expect(Math.abs(s.camera.zoom - prevCam.zoom)).toBeLessThan(0.25);
      expect(Math.abs(s.camera.pitch - prevCam.pitch)).toBeLessThan(3);
      prevCam = s.camera;
    }
  });

  it('shows the origin title in the intro and destination at the end', () => {
    expect(getAnimationState(model, 1).overlay.title?.name).toBe('ĐÀ NẴNG');
    expect(getAnimationState(model, 19.9).overlay.title?.name).toBe('HUẾ');
    expect(getAnimationState(model, 10).overlay.caption?.route).toBe('ĐÀ NẴNG → HUẾ');
  });

  it('interpolates the journey clock', () => {
    const mid = getAnimationState(model, 10).overlay.caption?.clock;
    expect(mid! > '08:00' && mid! < '10:30').toBe(true);
  });

  it('supports multi-segment journeys', () => {
    const second: LngLat[] = [
      [HUE.longitude, HUE.latitude],
      [HANOI.longitude, HANOI.latitude],
    ];
    const multi = createAnimationModel(prepareJourney(journeyWith([coords, second], [DA_NANG, HUE, HANOI])));
    const kinds = multi.timeline.phases.map((p) => p.kind);
    expect(kinds).toEqual(['intro', 'travel', 'hold', 'travel', 'outro']);
    const end = getAnimationState(multi, 20);
    expect(end.visibleRoute).toHaveLength(2);
    expect(end.vehicle!.transport).toBe('train');
    const hold = multi.timeline.phases[2]!;
    expect(getAnimationState(multi, (hold.start + hold.end) / 2 - 0.01).overlay.title?.name).toBe('HUẾ');
  });

  it('handles journeys without routes', () => {
    const empty = createAnimationModel(prepareJourney(createJourney()));
    const s = getAnimationState(empty, 5);
    expect(s.vehicle).toBeNull();
    expect(s.segmentIndex).toBe(-1);
  });

  it('timeline phases tile the duration exactly', () => {
    const t = buildTimeline(prepareJourney(journey), 7);
    expect(t.phases[0]!.start).toBe(0);
    expect(t.phases[t.phases.length - 1]!.end).toBe(7);
    for (let i = 1; i < t.phases.length; i++) expect(t.phases[i]!.start).toBeCloseTo(t.phases[i - 1]!.end, 9);
  });
});

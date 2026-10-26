import type { LngLat } from '../../models/journey';
import { getBearing, haversineDistance, interpolateCoordinate } from './geo';

/**
 * A route prepared for animation: coordinates plus cumulative distance at each vertex.
 * All animation lookups are by distance, never by array index, so unevenly spaced vertices
 * still produce constant-speed motion.
 */
export interface MeasuredRoute {
  coordinates: LngLat[];
  /** cumulative[i] = metres from the start to coordinates[i]; cumulative[0] = 0. */
  cumulative: number[];
  total: number;
}

export function calculateRouteDistances(coordinates: LngLat[]): MeasuredRoute {
  const cumulative = new Array<number>(coordinates.length);
  let total = 0;
  for (let i = 0; i < coordinates.length; i++) {
    if (i > 0) total += haversineDistance(coordinates[i - 1]!, coordinates[i]!);
    cumulative[i] = total;
  }
  return { coordinates, cumulative, total };
}

/** Index i such that cumulative[i] ≤ d < cumulative[i+1] (binary search). */
function segmentIndexAt(route: MeasuredRoute, d: number): number {
  const c = route.cumulative;
  let lo = 0;
  let hi = c.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (c[mid]! <= d) lo = mid;
    else hi = mid;
  }
  return lo;
}

function clampDistance(route: MeasuredRoute, d: number) {
  return Math.max(0, Math.min(route.total, d));
}

export function getPositionAtDistance(route: MeasuredRoute, distance: number): LngLat {
  const coords = route.coordinates;
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1 || route.total === 0) return coords[0]!;
  const d = clampDistance(route, distance);
  const i = segmentIndexAt(route, d);
  const a = coords[i]!;
  const b = coords[Math.min(i + 1, coords.length - 1)]!;
  const segLen = route.cumulative[Math.min(i + 1, coords.length - 1)]! - route.cumulative[i]!;
  const t = segLen > 0 ? (d - route.cumulative[i]!) / segLen : 0;
  return interpolateCoordinate(a, b, t);
}

/** The visible Vệt: every vertex up to `distance`, ending exactly at the interpolated point. */
export function getRouteUntilDistance(route: MeasuredRoute, distance: number): LngLat[] {
  const coords = route.coordinates;
  if (coords.length < 2) return coords.slice();
  const d = clampDistance(route, distance);
  if (d <= 0) return [];
  if (d >= route.total) return coords.slice();
  const i = segmentIndexAt(route, d);
  const out = coords.slice(0, i + 1);
  out.push(getPositionAtDistance(route, d));
  return out;
}

/**
 * Travel direction at `distance`, smoothed by looking `window` metres behind and ahead. A
 * wide window irons out zig-zags in dense road geometry so the vehicle turns gracefully.
 */
export function getSmoothedBearing(route: MeasuredRoute, distance: number, window: number): number {
  if (route.total === 0 || route.coordinates.length < 2) return 0;
  const w = Math.max(1, Math.min(window, route.total / 2));
  let from = distance - w;
  let to = distance + w;
  // Near the ends, slide the window inward instead of shrinking it, so bearing stays stable.
  if (from < 0) {
    to -= from;
    from = 0;
  }
  if (to > route.total) {
    from -= to - route.total;
    to = route.total;
  }
  const a = getPositionAtDistance(route, Math.max(0, from));
  const b = getPositionAtDistance(route, to);
  if (a[0] === b[0] && a[1] === b[1]) return 0;
  return getBearing(a, b);
}

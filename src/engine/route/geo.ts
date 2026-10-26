import type { LngLat } from '../../models/journey';

export const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance in metres. */
export function haversineDistance(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees clockwise from north in [0, 360). */
export function getBearing(a: LngLat, b: LngLat): number {
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLng = toRad(b[0] - a[0]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Linear interpolation between two coordinates. Route vertices are close together, so a planar
 * lerp is indistinguishable from a geodesic one at that scale (great-circle paths are densified
 * beforehand, see `greatCirclePath`).
 */
export function interpolateCoordinate(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Points along the great circle from a to b, inclusive of both ends. */
export function greatCirclePath(a: LngLat, b: LngLat, segments = 128): LngLat[] {
  const lat1 = toRad(a[1]);
  const lng1 = toRad(a[0]);
  const lat2 = toRad(b[1]);
  const lng2 = toRad(b[0]);
  const d = haversineDistance(a, b) / EARTH_RADIUS_M;
  if (d < 1e-9) return [a, b];
  const out: LngLat[] = [];
  let prevLng = a[0];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    let lng = toDeg(Math.atan2(y, x));
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    // Keep longitudes continuous across the antimeridian so the line doesn't wrap the globe.
    while (lng - prevLng > 180) lng -= 360;
    while (lng - prevLng < -180) lng += 360;
    prevLng = lng;
    out.push([lng, lat]);
  }
  return out;
}

/** Shortest signed difference b − a between two angles, in (−180, 180]. */
export function angleDelta(a: number, b: number): number {
  let d = (((b - a) % 360) + 540) % 360 - 180;
  if (d === -180) d = 180;
  return d;
}

// ── Web Mercator in normalised world units (0..1), as used by MapLibre ──────────

export function lngLatToMercator([lng, lat]: LngLat): [number, number] {
  const x = (lng + 180) / 360;
  const clampedLat = Math.max(-85.051129, Math.min(85.051129, lat));
  const s = Math.sin(toRad(clampedLat));
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  return [x, y];
}

export function mercatorToLngLat([x, y]: [number, number]): LngLat {
  const lng = x * 360 - 180;
  const lat = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * y))));
  return [lng, lat];
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function boundsOf(points: LngLat[]): Bounds | null {
  if (points.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return { west, south, east, north };
}

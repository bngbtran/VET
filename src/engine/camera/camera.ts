import type { LngLat } from '../../models/journey';
import { REFERENCE_VIEWPORT } from '../../models/video';
import { lerp } from '../animation/easing';
import { angleDelta, type Bounds, EARTH_RADIUS_M, lngLatToMercator, mercatorToLngLat } from '../route/geo';

/** Camera for the reference viewport (1920×1080 CSS px, 512 px tiles, MapLibre conventions). */
export interface CameraState {
  center: LngLat;
  zoom: number;
  bearing: number;
  pitch: number;
}

const TILE = 512;
export const MIN_ZOOM = 1.5;
export const MAX_ZOOM = 16.5;
const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

/** Zoom at which `meters` spans the reference viewport width at `latitude`. */
export function zoomForGroundWidth(meters: number, latitude: number): number {
  const circumference = 2 * Math.PI * EARTH_RADIUS_M * Math.cos((latitude * Math.PI) / 180);
  return clampZoom(Math.log2((circumference * REFERENCE_VIEWPORT.width) / (TILE * Math.max(1, meters))));
}

/** Pure equivalent of map.fitBounds for the reference viewport (pitch/bearing 0). */
export function fitBoundsCamera(bounds: Bounds, paddingFraction = 0.14, maxZoom = 14): CameraState {
  const [x0, y1] = lngLatToMercator([bounds.west, bounds.south]);
  const [x1, y0] = lngLatToMercator([bounds.east, bounds.north]);
  const { width, height } = REFERENCE_VIEWPORT;
  const availW = width * (1 - 2 * paddingFraction);
  const availH = height * (1 - 2 * paddingFraction);
  const dx = Math.max(x1 - x0, 1e-9);
  const dy = Math.max(y1 - y0, 1e-9);
  const zoom = Math.min(Math.log2(availW / (dx * TILE)), Math.log2(availH / (dy * TILE)), maxZoom);
  return {
    center: mercatorToLngLat([(x0 + x1) / 2, (y0 + y1) / 2]),
    zoom: clampZoom(zoom),
    bearing: 0,
    pitch: 0,
  };
}

function lerpAngle(a: number, b: number, t: number) {
  return (a + angleDelta(a, b) * t + 360) % 360;
}

/**
 * Smooth "fly" interpolation between two cameras (van Wijk & Nuij, the same model as
 * MapLibre's flyTo). Zoom and pan are coupled so the camera eases out, travels, and eases back
 * in, instead of zooming and panning independently. `t` should already be eased.
 */
export function interpolateCamera(a: CameraState, b: CameraState, t: number): CameraState {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const bearing = lerpAngle(a.bearing, b.bearing, t);
  const pitch = lerp(a.pitch, b.pitch, t);

  const ma = lngLatToMercator(a.center);
  const mb = lngLatToMercator(b.center);
  const scaleA = TILE * 2 ** a.zoom; // world size in px at zoom a
  const w0 = Math.max(REFERENCE_VIEWPORT.width, REFERENCE_VIEWPORT.height);
  const w1 = w0 / 2 ** (b.zoom - a.zoom);
  const u1 = Math.hypot(mb[0] - ma[0], mb[1] - ma[1]) * scaleA;
  const rho = 1.42;
  const rho2 = rho * rho;

  let zoom: number;
  let k: number; // fraction of the way along the pan
  if (u1 < 1e-6) {
    zoom = lerp(a.zoom, b.zoom, t);
    k = t;
  } else {
    const r = (i: 0 | 1) => {
      const bi = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
      return Math.log(Math.sqrt(bi * bi + 1) - bi);
    };
    const r0 = r(0);
    const S = (r(1) - r0) / rho;
    if (!Number.isFinite(S) || S <= 0) {
      zoom = lerp(a.zoom, b.zoom, t);
      k = t;
    } else {
      const s = t * S;
      const w = Math.cosh(r0) / Math.cosh(r0 + rho * s);
      const u = (w0 * ((Math.cosh(r0) * Math.tanh(r0 + rho * s) - Math.sinh(r0)) / rho2)) / u1;
      zoom = a.zoom + Math.log2(1 / w);
      k = u;
    }
  }

  const center = mercatorToLngLat([lerp(ma[0], mb[0], k), lerp(ma[1], mb[1], k)]);
  return { center, zoom, bearing, pitch };
}

/** Zoom offset to apply when rendering a reference-viewport camera into a viewport `cssWidth` wide. */
export function zoomOffsetForWidth(cssWidth: number): number {
  return Math.log2(cssWidth / REFERENCE_VIEWPORT.width);
}

import type { LngLat } from '../../models/journey';

/**
 * Douglas–Peucker simplification in degree space (with longitude scaled by cos(lat) so the
 * tolerance is roughly isotropic). Routing engines return thousands of vertices; pushing all of
 * them through the map source every frame is wasteful and invisible at video zoom levels.
 */
export function simplifyLine(points: LngLat[], toleranceMeters: number): LngLat[] {
  if (points.length <= 2) return points.slice();
  const midLat = points[Math.floor(points.length / 2)]![1];
  const kx = Math.cos((midLat * Math.PI) / 180);
  const tol = toleranceMeters / 111_320;
  const tolSq = tol * tol;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];

  while (stack.length) {
    const [first, last] = stack.pop()!;
    const a = points[first]!;
    const b = points[last]!;
    const ax = a[0] * kx;
    const bx = b[0] * kx;
    const dx = bx - ax;
    const dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    let maxSq = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const p = points[i]!;
      const px = p[0] * kx;
      let t = lenSq > 0 ? ((px - ax) * dx + (p[1] - a[1]) * dy) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = px - (ax + t * dx);
      const ey = p[1] - (a[1] + t * dy);
      const sq = ex * ex + ey * ey;
      if (sq > maxSq) {
        maxSq = sq;
        index = i;
      }
    }
    if (index !== -1 && maxSq > tolSq) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  const out: LngLat[] = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]!);
  return out;
}

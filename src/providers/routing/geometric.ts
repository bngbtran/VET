import type { LngLat, Route } from '../../models/journey';
import { greatCirclePath, haversineDistance, lngLatToMercator, mercatorToLngLat } from '../../engine/route/geo';
import { calculateRouteDistances } from '../../engine/route/measure';
import type { RouteProvider, RouteRequest } from './types';

const endpoints = ({ origin, destination }: RouteRequest): [LngLat, LngLat] => [
  [origin.longitude, origin.latitude],
  [destination.longitude, destination.latitude],
];

/** Airplanes fly great circles. Duration: cruise speed plus a fixed taxi/climb/descent overhead. */
export class GreatCircleRouteProvider implements RouteProvider {
  readonly id = 'great-circle';

  async getRoute(request: RouteRequest): Promise<Route> {
    const [a, b] = endpoints(request);
    const coordinates = greatCirclePath(a, b, 192);
    const distance = calculateRouteDistances(coordinates).total;
    return {
      coordinates,
      distance,
      estimatedDuration: 45 * 60 + distance / (800 / 3.6),
      source: this.id,
    };
  }
}

/**
 * APPROXIMATION — there is no free, keyless railway router. Until one is wired in, trains
 * travel a gentle arc between the stations (deliberately not a straight line, so it reads as
 * a rail path rather than a flight). The route is flagged `approximate` and the UI says so.
 */
export class ApproximateRailRouteProvider implements RouteProvider {
  readonly id = 'approx-rail';

  async getRoute(request: RouteRequest): Promise<Route> {
    const [a, b] = endpoints(request);
    const ma = lngLatToMercator(a);
    const mb = lngLatToMercator(b);
    const dx = mb[0] - ma[0];
    const dy = mb[1] - ma[1];
    // Quadratic Bézier with the control point offset 12% of the chord, perpendicular to it.
    const control: [number, number] = [(ma[0] + mb[0]) / 2 - dy * 0.12, (ma[1] + mb[1]) / 2 + dx * 0.12];
    const coordinates: LngLat[] = [];
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      coordinates.push(
        mercatorToLngLat([
          u * u * ma[0] + 2 * u * t * control[0] + t * t * mb[0],
          u * u * ma[1] + 2 * u * t * control[1] + t * t * mb[1],
        ]),
      );
    }
    coordinates[0] = a;
    coordinates[coordinates.length - 1] = b;
    // Rail lines are rarely straight: assume ~1.25× the crow-flies distance at 70 km/h.
    const distance = Math.max(calculateRouteDistances(coordinates).total, haversineDistance(a, b) * 1.25);
    return {
      coordinates,
      distance,
      estimatedDuration: distance / (70 / 3.6),
      approximate: true,
      source: this.id,
    };
  }
}

import type { LngLat, Route } from '../../models/journey';
import type { TransportMode } from '../../models/transport';
import { simplifyLine } from '../../engine/route/simplify';
import { AppError, fetchJson } from '../../utils/errors';
import type { RouteProvider, RouteRequest } from './types';

/**
 * FOSSGIS-hosted OSRM (routing.openstreetmap.de): free, keyless, CORS-enabled, and — unlike
 * the OSRM demo server — it serves separate car, bike and foot graphs.
 */
const BASE = 'https://routing.openstreetmap.de';

const PROFILE: Partial<Record<TransportMode, string>> = {
  car: 'routed-car',
  motorcycle: 'routed-car',
  bicycle: 'routed-bike',
  walking: 'routed-foot',
};

/** Motorbikes take the same roads as cars but rarely match car travel times. */
const DURATION_FACTOR: Partial<Record<TransportMode, number>> = { motorcycle: 1.15 };

interface OsrmResponse {
  code: string;
  message?: string;
  routes?: { distance: number; duration: number; geometry: { coordinates: LngLat[] } }[];
}

export class OsrmRouteProvider implements RouteProvider {
  readonly id = 'osrm-fossgis';

  async getRoute({ origin, destination, transport, signal }: RouteRequest): Promise<Route> {
    const profile = PROFILE[transport];
    if (!profile) throw new Error(`OSRM provider does not handle ${transport}`);
    const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const url = `${BASE}/${profile}/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=false&steps=false`;

    const data = await fetchJson<OsrmResponse>(url, {
      signal,
      timeoutMs: 20_000,
      onTimeout: new AppError('routing-timeout', 'The routing service took too long to answer. Try again in a moment.'),
      onNetwork: new AppError('routing-failed', 'Could not reach the routing service. Check your connection.'),
    });

    const route = data.routes?.[0];
    if (data.code !== 'Ok' || !route || route.geometry.coordinates.length < 2) {
      throw new AppError(
        'route-unavailable',
        data.code === 'NoRoute'
          ? `No ${transport === 'walking' ? 'walking' : transport === 'bicycle' ? 'cycling' : 'road'} route connects these places. Try another transport mode.`
          : 'No route found between these places.',
        data.message,
      );
    }

    // ~4 m tolerance: invisible at any zoom a journey video uses, typically 5–10× fewer vertices.
    const coordinates = simplifyLine(route.geometry.coordinates, 4);
    // Snap the ends to the chosen places so the Vệt starts and ends on the markers.
    coordinates[0] = [origin.longitude, origin.latitude];
    coordinates[coordinates.length - 1] = [destination.longitude, destination.latitude];

    return {
      coordinates,
      distance: route.distance,
      estimatedDuration: route.duration * (DURATION_FACTOR[transport] ?? 1),
      source: this.id,
    };
  }
}

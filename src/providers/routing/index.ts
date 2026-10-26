import type { Route } from '../../models/journey';
import type { TransportMode } from '../../models/transport';
import { ApproximateRailRouteProvider, GreatCircleRouteProvider } from './geometric';
import { OsrmRouteProvider } from './osrm';
import type { RouteProvider, RouteRequest } from './types';

export type { RouteProvider, RouteRequest } from './types';

const osrm = new OsrmRouteProvider();

/** One provider per transport mode. Adding a mode = adding a line here. */
const PROVIDERS: Record<TransportMode, RouteProvider> = {
  car: osrm,
  motorcycle: osrm,
  bicycle: osrm,
  walking: osrm,
  train: new ApproximateRailRouteProvider(),
  airplane: new GreatCircleRouteProvider(),
};

const cache = new Map<string, Route>();

export async function getRoute(request: RouteRequest): Promise<Route> {
  const key = [
    request.transport,
    request.origin.longitude.toFixed(6),
    request.origin.latitude.toFixed(6),
    request.destination.longitude.toFixed(6),
    request.destination.latitude.toFixed(6),
  ].join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const route = await PROVIDERS[request.transport].getRoute(request);
  cache.set(key, route);
  return route;
}

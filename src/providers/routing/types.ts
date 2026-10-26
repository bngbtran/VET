import type { Place, Route } from '../../models/journey';
import type { TransportMode } from '../../models/transport';

export interface RouteRequest {
  origin: Place;
  destination: Place;
  transport: TransportMode;
  signal?: AbortSignal;
}

export interface RouteProvider {
  readonly id: string;
  getRoute(request: RouteRequest): Promise<Route>;
}

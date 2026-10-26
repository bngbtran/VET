import type { Place } from '../../models/journey';

export interface GeocodeQuery {
  text: string;
  /** Results near this point rank higher (usually the map centre). */
  near?: { latitude: number; longitude: number };
  limit?: number;
  signal?: AbortSignal;
}

export interface GeocodingProvider {
  readonly id: string;
  search(query: GeocodeQuery): Promise<Place[]>;
}

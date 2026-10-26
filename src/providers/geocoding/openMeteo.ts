import type { Place } from '../../models/journey';
import { AppError, fetchJson } from '../../utils/errors';
import { isLatin, parseQuery } from './text';
import type { GeocodeQuery, GeocodingProvider } from './types';

/**
 * Open-Meteo geocoding (GeoNames data) — keyless, CORS-enabled, fast. Cities, towns and regions
 * only (no streets or landmarks; Photon covers those). language=vi gives Vietnamese names with
 * diacritics ("Quy Nhơn") and Vietnamese exonyms for the rest ("Bangkok, Thái Lan"), all Latin.
 */
const ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';

interface OpenMeteoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
}

export class OpenMeteoGeocodingProvider implements GeocodingProvider {
  readonly id = 'open-meteo';

  async search({ text, limit = 6, signal }: GeocodeQuery): Promise<Place[]> {
    // It matches a place *name*, so "Bangkok thái lan" becomes name=Bangkok + countryCode=TH.
    const { place, country } = parseQuery(text);
    if (place.length < 2) return [];
    const params = new URLSearchParams({ name: place, count: String(limit), language: 'vi', format: 'json' });
    if (country) params.set('countryCode', country.iso);

    const data = await fetchJson<{ results?: OpenMeteoResult[] }>(`${ENDPOINT}?${params}`, {
      signal,
      timeoutMs: 6_000,
      onTimeout: new AppError('geocoding-failed', 'Location search timed out. Try again.'),
      onNetwork: new AppError('geocoding-failed', 'Could not reach the location search service.'),
    });

    return (data.results ?? [])
      .filter((r) => isLatin(r.name))
      .map((r) => {
        const context = [r.admin1, r.country].filter((part): part is string => isLatin(part) && part !== r.name);
        return {
          id: `gn:${r.id}`,
          name: r.name,
          displayName: [r.name, ...context].join(', '),
          latitude: r.latitude,
          longitude: r.longitude,
        };
      });
  }
}

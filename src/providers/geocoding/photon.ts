import type { Place } from '../../models/journey';
import { AppError, fetchJson } from '../../utils/errors';
import type { GeocodeQuery, GeocodingProvider } from './types';

/**
 * Photon (komoot) — OSM-based, keyless, CORS-enabled and explicitly built for search-as-you-type.
 * Nominatim's usage policy forbids autocomplete, so it isn't used here.
 */
const ENDPOINT = 'https://photon.komoot.io/api/';

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    type?: string;
  };
}

/** Settlements first: "Da Nang" should mean the city before the airport named after it. */
const SETTLEMENTS = new Set(['city', 'town', 'village', 'municipality', 'suburb', 'hamlet', 'state', 'province', 'county']);
const isSettlement = (f: PhotonFeature) =>
  (f.properties.osm_key === 'place' || f.properties.osm_key === 'boundary') && SETTLEMENTS.has(f.properties.osm_value ?? '');

function toPlace(f: PhotonFeature): Place | null {
  const p = f.properties;
  const [longitude, latitude] = f.geometry.coordinates;
  const street = p.street ? [p.housenumber, p.street].filter(Boolean).join(' ') : undefined;
  const name = p.name ?? street ?? p.city ?? p.state;
  if (!name) return null;
  const context = [p.name ? street : undefined, p.district, p.city, p.state, p.country]
    .filter((part): part is string => !!part && part !== name);
  // Drop consecutive duplicates ("Đà Nẵng, Đà Nẵng").
  const unique = context.filter((part, i) => part !== context[i - 1]);
  return {
    id: p.osm_type && p.osm_id ? `osm:${p.osm_type}${p.osm_id}` : `pt:${longitude.toFixed(5)},${latitude.toFixed(5)}`,
    name,
    displayName: [name, ...unique].join(', '),
    latitude,
    longitude,
  };
}

export class PhotonGeocodingProvider implements GeocodingProvider {
  readonly id = 'photon';

  async search({ text, near, limit = 6, signal }: GeocodeQuery): Promise<Place[]> {
    // lang=default → names in the local language ("Đà Nẵng", not "Da Nang"), whatever the
    // browser's Accept-Language says.
    const params = new URLSearchParams({ q: text, limit: String(limit + 4), lang: 'default' });
    if (near) {
      params.set('lat', near.latitude.toFixed(3));
      params.set('lon', near.longitude.toFixed(3));
      // Gentle location bias; global results still surface.
      params.set('location_bias_scale', '0.3');
    }
    const data = await fetchJson<{ features?: PhotonFeature[] }>(`${ENDPOINT}?${params}`, {
      signal,
      timeoutMs: 10_000,
      onTimeout: new AppError('geocoding-failed', 'Location search timed out. Try again.'),
      onNetwork: new AppError('geocoding-failed', 'Could not reach the location search service.'),
    });
    const seen = new Set<string>();
    const places: Place[] = [];
    const features = (data.features ?? []).slice();
    // Stable sort keeps Photon's relevance order within each group.
    features.sort((a, b) => Number(isSettlement(b)) - Number(isSettlement(a)));
    for (const f of features) {
      const place = toPlace(f);
      if (!place || seen.has(place.displayName)) continue;
      seen.add(place.displayName);
      places.push(place);
    }
    return places.slice(0, limit);
  }
}

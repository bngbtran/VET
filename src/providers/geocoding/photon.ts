import type { Place } from '../../models/journey';
import { AppError, fetchJson } from '../../utils/errors';
import { isLatin, translateCountry } from './text';
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

/**
 * Settlements first, bigger first: "Bangkok" is the Thai capital before the Indonesian villages
 * of the same name, and "Da Nang" the city before the airport named after it.
 */
const SETTLEMENT_RANK: Record<string, number> = {
  city: 5, state: 4, province: 4, town: 3, municipality: 3, county: 2, suburb: 2, village: 1, hamlet: 1,
};
const settlementRank = (f: PhotonFeature) =>
  f.properties.osm_key === 'place' || f.properties.osm_key === 'boundary'
    ? (SETTLEMENT_RANK[f.properties.osm_value ?? ''] ?? 0)
    : 0;

const TEXT_FIELDS = ['name', 'street', 'housenumber', 'district', 'city', 'county', 'state', 'country'] as const;

const featureKey = (f: PhotonFeature) =>
  f.properties.osm_type && f.properties.osm_id
    ? `${f.properties.osm_type}${f.properties.osm_id}`
    : f.geometry.coordinates.join(',');

/**
 * Everything in Latin script. Start from the English names ("กรุงเทพมหานคร" → "Bangkok",
 * "ประเทศไทย" → "Thailand"), but prefer the local name wherever it is already Latin, so
 * Vietnamese keeps its diacritics ("Đà Nẵng", not "Da Nang"). Parts with no Latin form at all
 * are dropped — and so is the whole result if its own name has none.
 */
function romanize(english: PhotonFeature | undefined, local: PhotonFeature | undefined): PhotonFeature | null {
  const base = (english ?? local)!;
  const properties = { ...base.properties };
  for (const field of TEXT_FIELDS) {
    const localValue = local?.properties[field];
    const englishValue = english?.properties[field];
    properties[field] = isLatin(localValue) ? localValue : isLatin(englishValue) ? englishValue : undefined;
  }
  if (base.properties.name && !properties.name) return null;
  return { ...base, properties };
}

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

/** After a timeout, skip Photon for a while instead of making every keystroke wait it out. */
const COOL_DOWN_MS = 60_000;

export class PhotonGeocodingProvider implements GeocodingProvider {
  readonly id = 'photon';
  private unavailableUntil = 0;

  async search(query: GeocodeQuery): Promise<Place[]> {
    if (Date.now() < this.unavailableUntil) {
      throw new AppError('geocoding-failed', 'The detailed place search is not responding right now.');
    }
    try {
      return await this.searchNow(query);
    } catch (err) {
      if (err instanceof AppError && /timed out/.test(err.message)) this.unavailableUntil = Date.now() + COOL_DOWN_MS;
      throw err;
    }
  }

  private async searchNow({ text, near, limit = 6, signal }: GeocodeQuery): Promise<Place[]> {
    // Ask twice, in parallel: lang=en (Latin names, good ranking for foreign places) and
    // lang=default (local names, for Vietnamese diacritics). `romanize` merges them per field.
    const params = new URLSearchParams({ q: translateCountry(text), limit: String(limit + 4) });
    if (near) {
      params.set('lat', near.latitude.toFixed(3));
      params.set('lon', near.longitude.toFixed(3));
      // Regional, gentle bias (zoom 8 ≈ a province, not a street): searching "Hà Nội" from Huế
      // must find the city, not Hà Nội street around the corner.
      params.set('zoom', '8');
      params.set('location_bias_scale', '0.5');
    }
    const timedOut = new AppError('geocoding-failed', 'Location search timed out. Try again.');
    const get = (lang: string) => {
      const query = new URLSearchParams(params);
      query.set('lang', lang);
      return fetchJson<{ features?: PhotonFeature[] }>(`${ENDPOINT}?${query}`, {
        signal,
        timeoutMs: 8_000,
        onTimeout: timedOut,
        onNetwork: new AppError('geocoding-failed', 'Could not reach the location search service.'),
      });
    };
    // The free server sheds load with quick 503/429s now and then; one retry hides most of them.
    // A timeout means it's struggling — don't make the user wait through it twice.
    const request = (lang: string) =>
      get(lang).catch(async (err) => {
        if (signal?.aborted || err === timedOut) throw err;
        await new Promise((r) => setTimeout(r, 600));
        return get(lang);
      });

    // English ranking finds foreign places by their usual name; local results supply diacritics.
    // Don't let the local request hold results back: give it 1.5 s past the English answer.
    const localRequest = request('default').catch(() => null);
    const english = await request('en');
    const local = await Promise.race([localRequest, new Promise<null>((r) => setTimeout(() => r(null), 1_500))]);
    const localByKey = new Map((local?.features ?? []).map((f) => [featureKey(f), f]));
    const merged: PhotonFeature[] = [];
    for (const f of english.features ?? []) {
      const key = featureKey(f);
      const r = romanize(f, localByKey.get(key));
      localByKey.delete(key);
      if (r) merged.push(r);
    }
    // Places only the local search found (e.g. small Vietnamese streets) go after.
    for (const f of localByKey.values()) {
      const r = romanize(undefined, f);
      if (r) merged.push(r);
    }

    const seen = new Set<string>();
    const places: Place[] = [];
    // Stable sort keeps Photon's relevance order within each rank.
    const features = merged.sort((a, b) => settlementRank(b) - settlementRank(a));
    for (const f of features) {
      const place = toPlace(f);
      if (!place || seen.has(place.displayName)) continue;
      seen.add(place.displayName);
      places.push(place);
    }
    return places.slice(0, limit);
  }
}

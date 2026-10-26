import type { Place } from '../../models/journey';
import { haversineDistance } from '../../engine/route/geo';
import { AppError } from '../../utils/errors';
import { OpenMeteoGeocodingProvider } from './openMeteo';
import { PhotonGeocodingProvider } from './photon';
import type { GeocodeQuery, GeocodingProvider } from './types';

export type { GeocodeQuery, GeocodingProvider } from './types';

/**
 * Sources in display order: Open-Meteo answers fast with cities and towns; Photon adds streets,
 * landmarks and POIs (and is the free service most likely to be slow).
 */
const PROVIDERS: GeocodingProvider[] = [new OpenMeteoGeocodingProvider(), new PhotonGeocodingProvider()];

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/^(thanh pho|tinh|city of)\s+/, '')
    .trim();

/** Same place from two sources: matching name (ignoring accents/"Thành phố") within 5 km. */
function isDuplicate(a: Place, b: Place): boolean {
  const near = haversineDistance([a.longitude, a.latitude], [b.longitude, b.latitude]) < 5_000;
  const na = fold(a.name);
  const nb = fold(b.name);
  return near && (na === nb || na.includes(nb) || nb.includes(na));
}

function mergeResults(lists: (Place[] | undefined)[], limit: number): Place[] {
  const out: Place[] = [];
  for (const list of lists) {
    for (const place of list ?? []) {
      if (!out.some((p) => isDuplicate(p, place))) out.push(place);
    }
  }
  return out.slice(0, limit);
}

/**
 * Query every source in parallel and report merged results as each one answers, so a slow
 * source never holds back a fast one. Rejects only if every source fails.
 */
export async function searchPlaces(
  query: GeocodeQuery,
  onResults: (places: Place[], pending: boolean) => void,
): Promise<Place[]> {
  const limit = query.limit ?? 6;
  const lists: (Place[] | undefined)[] = PROVIDERS.map(() => undefined);
  const errors: unknown[] = [];
  let remaining = PROVIDERS.length;

  await Promise.all(
    PROVIDERS.map((provider, i) =>
      provider
        .search({ ...query, limit })
        .then((places) => {
          lists[i] = places;
        })
        .catch((err) => {
          if (query.signal?.aborted) throw err;
          errors.push(err);
        })
        .finally(() => {
          remaining--;
          if (!query.signal?.aborted) onResults(mergeResults(lists, limit), remaining > 0);
        }),
    ),
  );

  if (errors.length === PROVIDERS.length) {
    throw errors.find((e) => e instanceof AppError) ?? errors[0];
  }
  return mergeResults(lists, limit);
}

/** One-shot search over all sources (no streaming). */
export const geocoder: GeocodingProvider = {
  id: 'combined',
  search: (query) => searchPlaces(query, () => {}),
};

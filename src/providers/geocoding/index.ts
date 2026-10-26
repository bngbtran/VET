import { PhotonGeocodingProvider } from './photon';
import type { GeocodingProvider } from './types';

export type { GeocodeQuery, GeocodingProvider } from './types';

export const geocoder: GeocodingProvider = new PhotonGeocodingProvider();

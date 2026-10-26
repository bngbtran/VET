import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

/**
 * MapLibre 6 locates its worker relative to its own module URL, which a bundler rewrites. Point
 * it at the copy Vite emits instead. Import maplibre through this module so this always runs first.
 */
setWorkerUrl(workerUrl);

export { Map as MlMap } from 'maplibre-gl';
export type { ErrorEvent as MlErrorEvent, GeoJSONSource } from 'maplibre-gl';

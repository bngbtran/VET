export interface MapStyleOption {
  id: string;
  label: string;
  url: string;
  /** Used to pick contrasting marker / overlay colours. */
  tone: 'dark' | 'light';
  /** Burned into exported videos — OSM data requires credit. */
  attribution: string;
}

const CARTO = '© OpenStreetMap contributors · © CARTO';
const OFM = '© OpenStreetMap contributors · OpenMapTiles · OpenFreeMap';

/** Keyless vector basemaps. Both providers send `Access-Control-Allow-Origin: *`. */
export const MAP_STYLES: MapStyleOption[] = [
  { id: 'midnight', label: 'Midnight', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', tone: 'dark', attribution: CARTO },
  { id: 'fiord', label: 'Fiord', url: 'https://tiles.openfreemap.org/styles/fiord', tone: 'dark', attribution: OFM },
  { id: 'paper', label: 'Paper', url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json', tone: 'light', attribution: CARTO },
  { id: 'voyager', label: 'Voyager', url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json', tone: 'light', attribution: CARTO },
  { id: 'liberty', label: 'Liberty', url: 'https://tiles.openfreemap.org/styles/liberty', tone: 'light', attribution: OFM },
];

export const DEFAULT_MAP_STYLE = 'midnight';

export function getMapStyle(id: string): MapStyleOption {
  return MAP_STYLES.find((s) => s.id === id) ?? MAP_STYLES[0]!;
}

import type { FeatureCollection } from 'geojson';
import type { ExpressionSpecification, GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import type { LngLat } from '../../models/journey';
import type { PreparedJourney } from '../animation/prepare';
import type { AnimationState, MarkerState } from '../animation/state';

/**
 * The Vệt layers on a MapLibre map, kept separate so the preview map and the export map share
 * exactly the same rendering. Sources are created once and only their data changes per frame.
 */
const SRC = {
  background: 'vet-route-background',
  progress: 'vet-route-progress',
  markers: 'vet-markers',
} as const;

export const LAYERS = {
  background: 'vet-route-background',
  glow: 'vet-route-glow',
  progress: 'vet-route-progress',
  markerHalo: 'vet-marker-halo',
  marker: 'vet-marker',
} as const;

export interface SceneStyle {
  routeColor: string;
  tone: 'dark' | 'light';
}

type Fc = FeatureCollection;
const emptyFc = (): Fc => ({ type: 'FeatureCollection', features: [] });

/** Lines with an optional per-feature colour (each leg of a journey can have its own). */
function linesFc(lines: LngLat[][], colors: (string | undefined)[] = []): Fc {
  return {
    type: 'FeatureCollection',
    features: lines
      .map((coordinates, i) => ({ coordinates, color: colors[i] }))
      .filter((l) => l.coordinates.length >= 2)
      .map(({ coordinates, color }) => ({
        type: 'Feature',
        properties: color ? { color } : {},
        geometry: { type: 'LineString', coordinates },
      })),
  };
}

/** A feature's own colour, falling back to the journey's Vệt colour. */
const featureColor = (fallback: string) => ['coalesce', ['get', 'color'], fallback] as ExpressionSpecification;

function markersFc(markers: MarkerState[]): Fc {
  return {
    type: 'FeatureCollection',
    features: markers.map((m) => ({
      type: 'Feature',
      properties: { role: m.role, reached: m.reached, color: m.color },
      geometry: { type: 'Point', coordinates: m.position },
    })),
  };
}

export class MapScene {
  private readonly map: MlMap;
  private style: SceneStyle;
  private background: Fc = emptyFc();
  private progress: Fc = emptyFc();
  private markers: Fc = emptyFc();
  private progressKey = '';
  private markersKey = '';

  constructor(map: MlMap, style: SceneStyle) {
    this.map = map;
    this.style = style;
  }

  /** (Re)create sources and layers — call after every style load. */
  install(): void {
    const map = this.map;
    const { routeColor, tone } = this.style;
    const ground = tone === 'dark' ? '#0b0c0e' : '#ffffff';
    const add = (id: string, data: Fc) => {
      if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data, tolerance: 0.2, buffer: 64 });
    };
    add(SRC.background, this.background);
    add(SRC.progress, this.progress);
    add(SRC.markers, this.markers);

    const round = { 'line-cap': 'round', 'line-join': 'round' } as const;
    if (!map.getLayer(LAYERS.background)) {
      map.addLayer({
        id: LAYERS.background,
        type: 'line',
        source: SRC.background,
        layout: round,
        paint: { 'line-color': featureColor(routeColor), 'line-width': 2.5, 'line-opacity': tone === 'dark' ? 0.2 : 0.3 },
      });
    }
    if (!map.getLayer(LAYERS.glow)) {
      map.addLayer({
        id: LAYERS.glow,
        type: 'line',
        source: SRC.progress,
        layout: round,
        paint: { 'line-color': featureColor(routeColor), 'line-width': 18, 'line-blur': 14, 'line-opacity': tone === 'dark' ? 0.5 : 0.35 },
      });
    }
    if (!map.getLayer(LAYERS.progress)) {
      map.addLayer({
        id: LAYERS.progress,
        type: 'line',
        source: SRC.progress,
        layout: round,
        paint: { 'line-color': featureColor(routeColor), 'line-width': 5 },
      });
    }
    if (!map.getLayer(LAYERS.markerHalo)) {
      map.addLayer({
        id: LAYERS.markerHalo,
        type: 'circle',
        source: SRC.markers,
        paint: {
          'circle-radius': 15,
          'circle-color': featureColor(routeColor),
          'circle-blur': 0.6,
          'circle-opacity': ['case', ['get', 'reached'], 0.35, 0],
          'circle-pitch-alignment': 'map',
        },
      });
    }
    if (!map.getLayer(LAYERS.marker)) {
      map.addLayer({
        id: LAYERS.marker,
        type: 'circle',
        source: SRC.markers,
        paint: {
          'circle-radius': 7,
          'circle-color': ['case', ['get', 'reached'], featureColor(routeColor), ground],
          'circle-stroke-color': ['case', ['get', 'reached'], ground, featureColor(routeColor)],
          'circle-stroke-width': 2.5,
          'circle-pitch-alignment': 'map',
        },
      });
    }
  }

  setStyle(style: SceneStyle): void {
    this.style = style;
    const map = this.map;
    if (!map.getLayer(LAYERS.progress)) return;
    const ground = style.tone === 'dark' ? '#0b0c0e' : '#ffffff';
    const color = featureColor(style.routeColor);
    map.setPaintProperty(LAYERS.background, 'line-color', color);
    map.setPaintProperty(LAYERS.background, 'line-opacity', style.tone === 'dark' ? 0.2 : 0.3);
    map.setPaintProperty(LAYERS.glow, 'line-color', color);
    map.setPaintProperty(LAYERS.glow, 'line-opacity', style.tone === 'dark' ? 0.5 : 0.35);
    map.setPaintProperty(LAYERS.progress, 'line-color', color);
    map.setPaintProperty(LAYERS.markerHalo, 'circle-color', color);
    map.setPaintProperty(LAYERS.marker, 'circle-color', ['case', ['get', 'reached'], color, ground]);
    map.setPaintProperty(LAYERS.marker, 'circle-stroke-color', ['case', ['get', 'reached'], ground, color]);
  }

  /** The full, dim route that the Vệt will trace. */
  setJourney(journey: PreparedJourney): void {
    this.background = linesFc(
      journey.segments.map((s) => s.measured.coordinates),
      journey.segments.map((s) => s.color),
    );
    this.source(SRC.background)?.setData(this.background);
  }

  /** Apply one animation frame: Vệt, markers and camera. */
  apply(state: AnimationState): void {
    const last = state.visibleRoute[state.visibleRoute.length - 1];
    const tip = last?.[last.length - 1];
    const key = `${state.visibleRoute.length}:${last?.length ?? 0}:${tip?.[0]}:${tip?.[1]}:${state.routeColors.join()}`;
    if (key !== this.progressKey) {
      this.progressKey = key;
      this.progress = linesFc(state.visibleRoute, state.routeColors);
      this.source(SRC.progress)?.setData(this.progress);
    }

    const mKey = state.markers.map((m) => `${m.position[0]},${m.position[1]},${m.reached},${m.color}`).join('|');
    if (mKey !== this.markersKey) {
      this.markersKey = mKey;
      this.markers = markersFc(state.markers);
      this.source(SRC.markers)?.setData(this.markers);
    }

    const { center, zoom, bearing, pitch } = state.camera;
    this.map.jumpTo({ center, zoom, bearing, pitch });
  }

  private source(id: string): GeoJSONSource | undefined {
    return this.map.getSource<GeoJSONSource>(id);
  }
}

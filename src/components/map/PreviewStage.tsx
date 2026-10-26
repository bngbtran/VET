import { MlMap, type MlErrorEvent } from '../../providers/maps/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { player } from '../../engine/animation/player';
import type { PreparedJourney } from '../../engine/animation/prepare';
import { drawOverlay, OVERLAY_FONTS } from '../../engine/overlay/drawOverlay';
import { loadVehicleImages } from '../../engine/scene/icons';
import { MapScene, type SceneStyle } from '../../engine/scene/mapScene';
import type { TransportMode } from '../../models/transport';
import { REFERENCE_VIEWPORT } from '../../models/video';
import { getMapStyle } from '../../providers/maps/styles';

const { width: RW, height: RH } = REFERENCE_VIEWPORT;

interface Props {
  journey: PreparedJourney;
}

/**
 * The preview: a MapLibre map laid out at the reference 1920×1080 and CSS-scaled to fit, with
 * the overlay canvas on top. Because layout matches the export exactly, what you see here is
 * what gets rendered into the video.
 */
export function PreviewStage({ journey }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const sceneRef = useRef<MapScene | null>(null);
  const journeyRef = useRef(journey);
  const vehiclesRef = useRef<Map<TransportMode, HTMLImageElement>>(new Map());
  const pixelRatioRef = useRef(1);
  /**
   * True between 'style.load' and the next setStyle. Not map.isStyleLoaded(): that is also false
   * whenever tiles are loading, which would silently drop camera/route updates.
   */
  const styleReadyRef = useRef(false);
  const [scale, setScale] = useState(0.5);
  const [mapError, setMapError] = useState<string | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);

  const settings = journey.settings;
  const mapStyle = getMapStyle(settings.mapStyle);
  const { routeColor } = settings;
  const { tone, url: styleUrl, attribution } = mapStyle;
  const sceneStyleRef = useRef<SceneStyle>({ routeColor, tone });
  const attributionRef = useRef(attribution);
  const styleUrlRef = useRef(styleUrl);

  // Latest values for the long-lived map callbacks.
  useLayoutEffect(() => {
    journeyRef.current = journey;
    sceneStyleRef.current = { routeColor, tone };
    attributionRef.current = attribution;
  });

  // Fit the 16:9 frame into the available space.
  useEffect(() => {
    const el = frameRef.current!;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      setScale(Math.max(0.1, Math.min(width / RW, height / RH)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Create the map once.
  useEffect(() => {
    const map = new MlMap({
      container: mapContainerRef.current!,
      style: styleUrlRef.current,
      center: journeyRef.current.overview.center,
      zoom: journeyRef.current.overview.zoom,
      attributionControl: false,
      fadeDuration: 0,
      maxPitch: 70,
      pixelRatio: pixelRatioRef.current,
      canvasContextAttributes: { antialias: true },
    });
    mapRef.current = map;
    const scene = new MapScene(map, sceneStyleRef.current);
    sceneRef.current = scene;

    let loadedOnce = false;
    const loadTimer = window.setTimeout(() => {
      if (!loadedOnce) setMapError('The map is taking unusually long to load. Check your connection.');
    }, 20_000);

    map.on('style.load', () => {
      styleReadyRef.current = true;
      loadedOnce = true;
      setMapError(null);
      setStyleLoaded(true);
      scene.install();
      scene.setStyle(sceneStyleRef.current);
      scene.setJourney(journeyRef.current);
      player.refresh();
    });
    map.on('error', (e: MlErrorEvent) => {
      // Individual tile failures are normal and recover; only a missing style is fatal.
      if (!map.isStyleLoaded() && !loadedOnce) {
        setMapError(`The map style could not be loaded${e.error?.message ? ` (${e.error.message})` : ''}.`);
      }
    });

    const drawFrame = () => {
      const canvas = overlayRef.current;
      const state = player.state;
      if (!canvas || !state) return;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawOverlay(
        {
          ctx,
          scale: pixelRatioRef.current,
          project: (p) => map.project(p),
          vehicles: vehiclesRef.current,
          style: sceneStyleRef.current,
          attribution: attributionRef.current,
        },
        state,
      );
    };
    map.on('render', drawFrame);

    const offFrame = player.onFrame((state) => {
      if (!styleReadyRef.current) return;
      scene.apply(state);
      map.triggerRepaint(); // guarantees a 'render' → overlay redraw in sync with the map
    });

    void loadVehicleImages().then((imgs) => {
      vehiclesRef.current = imgs;
      map.triggerRepaint();
    });
    void Promise.all(OVERLAY_FONTS.map((f) => document.fonts.load(f))).then(() => map.triggerRepaint());

    return () => {
      window.clearTimeout(loadTimer);
      offFrame();
      map.remove();
      mapRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  // Keep the backing resolution matched to on-screen pixels.
  useEffect(() => {
    const pr = Math.max(0.5, Math.min(2, scale * window.devicePixelRatio));
    pixelRatioRef.current = pr;
    mapRef.current?.setPixelRatio(pr);
    const canvas = overlayRef.current;
    if (canvas) {
      canvas.width = Math.round(RW * pr);
      canvas.height = Math.round(RH * pr);
    }
    mapRef.current?.triggerRepaint();
  }, [scale]);

  // Style switch.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleUrlRef.current === styleUrl) return;
    styleUrlRef.current = styleUrl;
    setStyleLoaded(false);
    styleReadyRef.current = false;
    map.setStyle(styleUrl, { diff: false });
  }, [styleUrl]);

  // Route colour / tone.
  useEffect(() => {
    sceneRef.current?.setStyle({ routeColor, tone });
    mapRef.current?.triggerRepaint();
  }, [routeColor, tone]);

  // New journey data → new background route + animation model.
  useEffect(() => {
    if (styleReadyRef.current) sceneRef.current?.setJourney(journey);
    player.setJourney(journey);
  }, [journey]);

  return (
    <div ref={frameRef} className="relative h-full w-full overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2 overflow-hidden rounded-[3px] bg-[#0b0c0e] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_80px_rgba(0,0,0,0.5)]"
        style={{ width: RW, height: RH, transform: `translate(-50%, -50%) scale(${scale})` }}
        data-testid="preview-frame"
      >
        {/* Inline: maplibre-gl.css sets `position: relative` unlayered, which beats Tailwind's layer. */}
        <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        {!styleLoaded && !mapError && (
          <div className="absolute inset-0 grid place-items-center text-[28px] tracking-[0.3em] text-white/30">LOADING MAP</div>
        )}
      </div>
      {mapError && (
        <div className="absolute inset-x-0 top-6 mx-auto w-fit max-w-[90%] rounded-md border border-red-400/30 bg-[#1a0f0f] px-4 py-3 text-sm text-red-200">
          {mapError}{' '}
          <button className="ml-2 underline" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
    </div>
  );
}

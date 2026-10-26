import { MlMap, type MlErrorEvent } from '../../providers/maps/maplibre';
import type { PreparedJourney } from '../animation/prepare';
import type { AnimationState } from '../animation/state';
import { drawOverlay, OVERLAY_FONTS } from '../overlay/drawOverlay';
import { loadVehicleImages } from '../scene/icons';
import { MapScene, type SceneStyle } from '../scene/mapScene';
import type { TransportMode } from '../../models/transport';
import { REFERENCE_VIEWPORT } from '../../models/video';
import { AppError } from '../../utils/errors';

export interface RenderTarget {
  width: number;
  height: number;
  styleUrl: string;
  attribution: string;
  sceneStyle: SceneStyle;
}

/**
 * Renders animation states to video frames deterministically. A dedicated, hidden map is laid
 * out at the reference 1920×1080 with pixelRatio = width / 1920, so framing is identical to the
 * preview at any resolution. For every frame we apply the state, wait until every tile and
 * source is loaded (`idle`), and only then copy the pixels — never a screen recording.
 */
export class FrameRenderer {
  private constructor(
    private readonly map: MlMap,
    private readonly container: HTMLDivElement,
    private readonly scene: MapScene,
    private readonly canvas: HTMLCanvasElement,
    private readonly ctx: CanvasRenderingContext2D,
    private readonly target: RenderTarget,
    private readonly vehicles: Map<TransportMode, HTMLImageElement>,
    private contextLost: { lost: boolean },
  ) {}

  static async create(journey: PreparedJourney, target: RenderTarget, signal: AbortSignal): Promise<FrameRenderer> {
    const { width: RW, height: RH } = REFERENCE_VIEWPORT;
    const container = document.createElement('div');
    // Off-screen but laid out and rendered (display:none would give the map a 0×0 canvas).
    Object.assign(container.style, {
      position: 'fixed',
      left: '-20000px',
      top: '0',
      width: `${RW}px`,
      height: `${RH}px`,
      pointerEvents: 'none',
    });
    container.setAttribute('aria-hidden', 'true');
    document.body.appendChild(container);

    const pixelRatio = target.width / RW;
    const map = new MlMap({
      container,
      style: target.styleUrl,
      center: journey.overview.center,
      zoom: journey.overview.zoom,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      maxPitch: 70,
      pixelRatio,
      maxCanvasSize: [4096, 4096],
      canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
    });

    const contextLost = { lost: false };
    map.getCanvas().addEventListener('webglcontextlost', () => (contextLost.lost = true));

    const fail = (err: unknown) => {
      map.remove();
      container.remove();
      throw err;
    };

    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new AppError('map-load-failed', 'The map style did not load for export. Check your connection.')),
          30_000,
        );
        signal.addEventListener('abort', () => reject(new AppError('export-cancelled', 'Export cancelled.')), { once: true });
        map.once('style.load', () => {
          clearTimeout(timer);
          resolve();
        });
        map.on('error', (e: MlErrorEvent) => {
          if (!map.isStyleLoaded()) {
            clearTimeout(timer);
            reject(new AppError('map-load-failed', 'The map could not be loaded for export.', e.error?.message));
          }
        });
      });
    } catch (err) {
      return fail(err);
    }

    const actual = map.getCanvas();
    if (Math.abs(actual.width - target.width) > 2 || Math.abs(actual.height - target.height) > 2) {
      return fail(
        new AppError(
          'out-of-memory',
          `This device can't render a ${target.width}×${target.height} map (max ${actual.width}×${actual.height}). Choose a lower resolution.`,
        ),
      );
    }

    const scene = new MapScene(map, target.sceneStyle);
    scene.install();
    scene.setStyle(target.sceneStyle);
    scene.setJourney(journey);

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return fail(new AppError('out-of-memory', 'Could not allocate the video frame buffer. Choose a lower resolution.'));

    const [vehicles] = await Promise.all([loadVehicleImages(), ...OVERLAY_FONTS.map((f) => document.fonts.load(f))]);
    return new FrameRenderer(map, container, scene, canvas, ctx, target, vehicles, contextLost);
  }

  /** Render one state and return it as a VideoFrame (caller owns and must close/transfer it). */
  async render(state: AnimationState, timestampUs: number, durationUs: number, signal: AbortSignal): Promise<VideoFrame> {
    this.scene.apply(state);
    await this.waitUntilSettled(signal);
    if (this.contextLost.lost) {
      throw new AppError('out-of-memory', 'The graphics card ran out of memory. Choose a lower resolution.');
    }

    const { ctx, target } = this;
    ctx.drawImage(this.map.getCanvas(), 0, 0, target.width, target.height);
    drawOverlay(
      {
        ctx,
        scale: target.width / REFERENCE_VIEWPORT.width,
        project: (p) => this.map.project(p),
        vehicles: this.vehicles,
        style: target.sceneStyle,
        attribution: target.attribution,
      },
      state,
    );
    return new VideoFrame(this.canvas, { timestamp: timestampUs, duration: durationUs });
  }

  /** Resolve once the map has drawn the current camera with every tile loaded. */
  private async waitUntilSettled(signal: AbortSignal): Promise<void> {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (signal.aborted) throw new AppError('export-cancelled', 'Export cancelled.');
      // Rendering pauses while the tab is hidden; wait for it to come back instead of timing out.
      if (document.hidden) await new Promise((r) => document.addEventListener('visibilitychange', r, { once: true }));
      const idle = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          this.map.off('idle', onIdle);
          resolve(false);
        }, 15_000);
        const onIdle = () => {
          clearTimeout(timer);
          resolve(true);
        };
        this.map.once('idle', onIdle);
        this.map.triggerRepaint();
      });
      if (idle && this.map.loaded()) return;
      if (!idle && !document.hidden) return; // tiles unavailable (network); render what we have
    }
  }

  destroy(): void {
    this.map.remove();
    this.container.remove();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}

import type { PreparedJourney } from '../animation/prepare';
import { createAnimationModel, getAnimationState } from '../animation/state';
import { getMapStyle } from '../../providers/maps/styles';
import { AppError } from '../../utils/errors';
import { WorkerVideoEncoder } from './encoder';
import { FrameRenderer } from './frameRenderer';
import type { ContainerFormat, EncoderInfo } from './protocol';

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  format: ContainerFormat;
  name: string;
}

export interface ExportProgress {
  stage: 'preparing' | 'rendering' | 'finalizing';
  frame: number;
  totalFrames: number;
  /** Seconds, or null until there's enough data to estimate. */
  remaining: number | null;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  info: EncoderInfo;
  seconds: number;
}

export function isExportSupported(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && typeof Worker !== 'undefined';
}

/** Bits per second: ~0.18 bits/pixel/frame — generous, because map detail is fine-grained. */
export function bitrateFor(width: number, height: number, fps: number): number {
  return Math.min(50_000_000, Math.round(width * height * fps * 0.18));
}

export function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'journey'
  );
}

/**
 * Deterministic export: frame n shows exactly getAnimationState(n / fps), however long each
 * frame takes to render. Rendering stays on the main thread (it needs the DOM/WebGL); encoding
 * and muxing run in a worker. Awaiting each frame yields to the event loop, so the UI stays live.
 */
export async function exportVideo(
  journey: PreparedJourney,
  options: ExportOptions,
  onProgress: (p: ExportProgress) => void,
  signal: AbortSignal,
): Promise<ExportResult> {
  if (!isExportSupported()) {
    throw new AppError(
      'webcodecs-unsupported',
      'This browser cannot encode video (WebCodecs is missing). Use a recent Chrome, Edge, or Firefox on desktop.',
    );
  }
  if (journey.segments.length === 0) throw new AppError('export-failed', 'Add a route before exporting.');

  const { width, height, fps } = options;
  const model = createAnimationModel(journey);
  const totalFrames = Math.max(1, Math.round(model.timeline.duration * fps));
  const style = getMapStyle(journey.settings.mapStyle);
  const started = performance.now();
  onProgress({ stage: 'preparing', frame: 0, totalFrames, remaining: null });

  const encoder = new WorkerVideoEncoder();
  const onAbort = () => encoder.cancel();
  signal.addEventListener('abort', onAbort, { once: true });
  const rendererReady = FrameRenderer.create(
    journey,
    {
      width,
      height,
      styleUrl: style.url,
      attribution: style.attribution,
      sceneStyle: { routeColor: journey.settings.routeColor, tone: style.tone },
    },
    signal,
  );

  try {
    const [info, renderer] = await Promise.all([
      encoder.initialize({ width, height, fps, bitrate: bitrateFor(width, height, fps), format: options.format }),
      rendererReady,
    ]);

    const frameUs = 1_000_000 / fps;
    const inFlight: Promise<void>[] = [];
    const renderStart = performance.now();
    for (let i = 0; i < totalFrames; i++) {
      if (signal.aborted) throw new AppError('export-cancelled', 'Export cancelled.');
      const state = getAnimationState(model, i / fps);
      const frame = await renderer.render(state, Math.round(i * frameUs), Math.round(frameUs), signal);
      inFlight.push(encoder.encodeFrame(frame, i));
      // Render frame n+1 while the worker encodes frame n, but never run far ahead.
      if (inFlight.length > 2) await inFlight.shift();

      const done = i + 1;
      const perFrame = (performance.now() - renderStart) / done;
      onProgress({
        stage: 'rendering',
        frame: done,
        totalFrames,
        remaining: done >= 5 ? ((totalFrames - done) * perFrame) / 1000 : null,
      });
    }
    await Promise.all(inFlight);

    onProgress({ stage: 'finalizing', frame: totalFrames, totalFrames, remaining: 0 });
    const blob = await encoder.finalize();
    return {
      blob,
      filename: `vet-${slugify(options.name)}-${height}p${fps}.${info.extension}`,
      info,
      seconds: (performance.now() - started) / 1000,
    };
  } catch (err) {
    encoder.cancel();
    if (signal.aborted) throw new AppError('export-cancelled', 'Export cancelled.');
    if (err instanceof AppError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof RangeError || /memory|allocat/i.test(message)) {
      throw new AppError('out-of-memory', 'Ran out of memory while exporting. Try a lower resolution or a shorter video.', message);
    }
    throw new AppError('export-failed', `Export failed: ${message}`, message);
  } finally {
    signal.removeEventListener('abort', onAbort);
    // Also covers the renderer finishing setup after the encoder already failed.
    rendererReady.then((r) => r.destroy(), () => {});
  }
}

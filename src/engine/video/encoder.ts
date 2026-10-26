import { AppError } from '../../utils/errors';
import type { EncoderConfig, EncoderInfo, FromWorker, ToWorker } from './protocol';

export interface VideoEncoderProvider {
  initialize(config: EncoderConfig): Promise<EncoderInfo>;
  /** Resolves once the encoder has accepted the frame. Ownership of `frame` transfers. */
  encodeFrame(frame: VideoFrame, index: number): Promise<void>;
  finalize(): Promise<Blob>;
  cancel(): void;
}

/** Encoder running in a dedicated worker (WebCodecs + mediabunny muxer). */
export class WorkerVideoEncoder implements VideoEncoderProvider {
  private worker: Worker;
  private info: EncoderInfo | null = null;
  private pendingAcks = new Map<number, { resolve: () => void; reject: (e: unknown) => void }>();
  private onReady: { resolve: (i: EncoderInfo) => void; reject: (e: unknown) => void } | null = null;
  private onDone: { resolve: (b: Blob) => void; reject: (e: unknown) => void } | null = null;
  private error: AppError | null = null;

  constructor() {
    this.worker = new Worker(new URL('../../workers/encoder.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.handle(e.data);
    this.worker.onerror = (e) => this.failAll(new AppError('encoder-failed', 'The video encoder crashed.', e.message));
  }

  initialize(config: EncoderConfig): Promise<EncoderInfo> {
    return new Promise((resolve, reject) => {
      this.onReady = { resolve, reject };
      this.send({ type: 'init', config });
    });
  }

  encodeFrame(frame: VideoFrame, index: number): Promise<void> {
    if (this.error) {
      frame.close();
      return Promise.reject(this.error);
    }
    return new Promise((resolve, reject) => {
      this.pendingAcks.set(index, { resolve, reject });
      this.send({ type: 'frame', index, frame }, [frame]);
    });
  }

  finalize(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (this.error) return reject(this.error);
      this.onDone = { resolve, reject };
      this.send({ type: 'finalize' });
    });
  }

  cancel(): void {
    this.send({ type: 'cancel' });
    this.failAll(new AppError('export-cancelled', 'Export cancelled.'));
    // Give the worker a moment to release encoder resources, then kill it.
    setTimeout(() => this.worker.terminate(), 500);
  }

  dispose(): void {
    this.worker.terminate();
  }

  private send(msg: ToWorker, transfer: Transferable[] = []) {
    this.worker.postMessage(msg, transfer);
  }

  private handle(msg: FromWorker) {
    switch (msg.type) {
      case 'ready':
        this.info = msg.info;
        this.onReady?.resolve(msg.info);
        this.onReady = null;
        break;
      case 'ack':
        this.pendingAcks.get(msg.index)?.resolve();
        this.pendingAcks.delete(msg.index);
        break;
      case 'done':
        this.onDone?.resolve(new Blob([msg.buffer], { type: this.info?.mimeType ?? 'video/mp4' }));
        this.onDone = null;
        this.worker.terminate();
        break;
      case 'error':
        this.failAll(
          msg.unsupported
            ? new AppError('webcodecs-unsupported', unsupportedMessage(msg.message), msg.message)
            : new AppError('encoder-failed', encoderMessage(msg.message), msg.message),
        );
        break;
    }
  }

  private failAll(err: AppError) {
    if (!this.error) this.error = err;
    this.onReady?.reject(err);
    this.onDone?.reject(err);
    for (const p of this.pendingAcks.values()) p.reject(err);
    this.pendingAcks.clear();
    this.onReady = null;
    this.onDone = null;
  }
}

function unsupportedMessage(detail: string): string {
  if (/support/i.test(detail) && /×/.test(detail)) return `${detail} Try a lower resolution.`;
  return 'This browser cannot encode video (WebCodecs is missing). Use a recent Chrome, Edge, or Firefox on desktop.';
}

function encoderMessage(detail: string): string {
  if (/memory|allocat|quota/i.test(detail)) return 'The encoder ran out of memory. Try a lower resolution, 30 FPS, or a shorter video.';
  return `Video encoding failed: ${detail}`;
}

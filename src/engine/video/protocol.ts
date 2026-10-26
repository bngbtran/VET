/** Messages between the main thread and the encoder worker. */

export type ContainerFormat = 'mp4' | 'webm';

export interface EncoderConfig {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  /** Preferred container; the worker falls back to WebM/VP9 if H.264 can't be encoded. */
  format: ContainerFormat;
}

export interface EncoderInfo {
  codec: string;
  format: ContainerFormat;
  mimeType: string;
  extension: string;
}

export type ToWorker =
  | { type: 'init'; config: EncoderConfig }
  | { type: 'frame'; index: number; frame: VideoFrame }
  | { type: 'finalize' }
  | { type: 'cancel' };

export type FromWorker =
  | { type: 'ready'; info: EncoderInfo }
  | { type: 'ack'; index: number }
  | { type: 'done'; buffer: ArrayBuffer }
  | { type: 'error'; message: string; unsupported?: boolean };

import {
  BufferTarget,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  VideoSample,
  VideoSampleSource,
  WebMOutputFormat,
  type VideoCodec,
} from 'mediabunny';
import type { EncoderConfig, EncoderInfo, FromWorker, ToWorker } from '../engine/video/protocol';

/**
 * WebCodecs encoding + muxing, off the main thread. Frames arrive as transferred VideoFrames;
 * `source.add` resolves only once the encoder can take more, which gives natural backpressure.
 */
const scope = self as unknown as {
  postMessage(message: FromWorker, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
};

let output: Output | null = null;
let source: VideoSampleSource | null = null;
let fps = 30;
/** Serialises frame handling so packets are muxed strictly in order. */
let queue: Promise<void> = Promise.resolve();
let failed = false;

const post = (msg: FromWorker, transfer: Transferable[] = []) => scope.postMessage(msg, transfer);

function fail(err: unknown, unsupported = false) {
  failed = true;
  const message = err instanceof Error ? err.message : String(err);
  post({ type: 'error', message, unsupported });
}

async function init(config: EncoderConfig) {
  if (typeof VideoEncoder === 'undefined') {
    fail(new Error('WebCodecs VideoEncoder is not available in this browser.'), true);
    return;
  }
  fps = config.fps;
  const opts = { width: config.width, height: config.height, bitrate: config.bitrate };
  const order: { format: 'mp4' | 'webm'; codecs: VideoCodec[] }[] =
    config.format === 'mp4'
      ? [
          { format: 'mp4', codecs: ['avc'] },
          { format: 'webm', codecs: ['vp9', 'vp8'] },
        ]
      : [
          { format: 'webm', codecs: ['vp9', 'vp8'] },
          { format: 'mp4', codecs: ['avc'] },
        ];

  let chosen: { format: 'mp4' | 'webm'; codec: VideoCodec } | null = null;
  for (const option of order) {
    const codec = await getFirstEncodableVideoCodec(option.codecs, opts);
    if (codec) {
      chosen = { format: option.format, codec };
      break;
    }
  }
  if (!chosen) {
    fail(new Error(`No video encoder in this browser supports ${config.width}×${config.height}.`), true);
    return;
  }

  output = new Output({
    format: chosen.format === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  source = new VideoSampleSource({
    codec: chosen.codec,
    bitrate: config.bitrate,
    keyFrameInterval: 2,
    latencyMode: 'quality',
  });
  output.addVideoTrack(source, { frameRate: config.fps });
  await output.start();

  const info: EncoderInfo = {
    codec: chosen.codec,
    format: chosen.format,
    mimeType: chosen.format === 'mp4' ? 'video/mp4' : 'video/webm',
    extension: chosen.format,
  };
  post({ type: 'ready', info });
}

async function encode(index: number, frame: VideoFrame) {
  if (!source || failed) {
    frame.close();
    return;
  }
  const sample = new VideoSample(frame, { timestamp: index / fps, duration: 1 / fps });
  try {
    await source.add(sample);
  } finally {
    sample.close();
    frame.close();
  }
  post({ type: 'ack', index });
}

async function finalize() {
  if (!output || !source || failed) return;
  source.close();
  await output.finalize();
  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new Error('The encoder produced no data.');
  post({ type: 'done', buffer }, [buffer]);
  output = null;
  source = null;
}

scope.onmessage = (event) => {
  const msg = event.data;
  if (msg.type === 'cancel') {
    failed = true;
    const out = output;
    output = null;
    source = null;
    void out?.cancel().catch(() => {});
    return;
  }
  queue = queue
    .then(async () => {
      if (msg.type === 'init') await init(msg.config);
      else if (msg.type === 'frame') await encode(msg.index, msg.frame);
      else if (msg.type === 'finalize') await finalize();
    })
    .catch((err) => {
      if (msg.type === 'frame') msg.frame.close();
      fail(err);
    });
};

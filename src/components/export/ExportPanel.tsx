import { useEffect, useRef, useState } from 'react';
import { player } from '../../engine/animation/player';
import { bitrateFor, exportVideo, isExportSupported, type ExportProgress, type ExportResult } from '../../engine/video/exportVideo';
import type { ContainerFormat } from '../../engine/video/protocol';
import { usePreparedJourney } from '../../hooks/usePreparedJourney';
import { useVideoDuration } from '../../hooks/useVideoDuration';
import { QUALITY_PRESETS } from '../../models/video';
import { journeyActions, useJourney } from '../../stores/journeyStore';
import { AppError, describeError } from '../../utils/errors';
import { Button, FieldLabel, Section, Segmented } from '../ui/controls';
import { ExportDialog } from './ExportDialog';

export type ExportJob =
  | { status: 'running'; progress: ExportProgress }
  | { status: 'done'; result: ExportResult; url: string }
  | { status: 'error'; message: string }
  | { status: 'cancelled' };

export function ExportPanel({ disabled }: { disabled: boolean }) {
  const video = useJourney((s) => s.journey.videoSettings);
  const name = useJourney((s) => s.journey.name);
  const journey = usePreparedJourney();
  const [format, setFormat] = useState<ContainerFormat>('mp4');
  const [job, setJob] = useState<ExportJob | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const supported = isExportSupported();

  const preset = QUALITY_PRESETS.find((p) => p.width === video.width && p.height === video.height) ?? QUALITY_PRESETS[1]!;
  const duration = useVideoDuration();
  const frames = Math.round(duration * video.fps);
  const estimateMb = (bitrateFor(video.width, video.height, video.fps) * duration) / 8 / 1_000_000;

  const start = async () => {
    player.pause();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setJob({ status: 'running', progress: { stage: 'preparing', frame: 0, totalFrames: frames, remaining: null } });
    try {
      const result = await exportVideo(
        journey,
        { width: video.width, height: video.height, fps: video.fps, format, name },
        (progress) => setJob({ status: 'running', progress }),
        ctrl.signal,
      );
      setJob({ status: 'done', result, url: URL.createObjectURL(result.blob) });
    } catch (err) {
      if (err instanceof AppError && err.code === 'export-cancelled') setJob({ status: 'cancelled' });
      else setJob({ status: 'error', message: describeError(err) });
      console.error('[vet] export failed', err);
    } finally {
      abortRef.current = null;
    }
  };

  // Warn before closing the tab mid-export; release the blob when done.
  const running = job?.status === 'running';
  useEffect(() => {
    if (!running) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [running]);
  const doneUrl = job?.status === 'done' ? job.url : null;
  useEffect(() => () => void (doneUrl && URL.revokeObjectURL(doneUrl)), [doneUrl]);

  return (
    <Section title="EXPORT">
      <FieldLabel>Quality</FieldLabel>
      <Segmented
        label="Video quality"
        size="sm"
        value={preset.id}
        options={QUALITY_PRESETS.map((p) => ({ value: p.id, label: p.label, title: `${p.width}×${p.height}` }))}
        onChange={(id) => {
          const p = QUALITY_PRESETS.find((q) => q.id === id)!;
          journeyActions.updateVideo({ width: p.width, height: p.height });
        }}
      />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Frame rate</FieldLabel>
          <Segmented
            label="Frame rate"
            size="sm"
            value={video.fps}
            options={[
              { value: 30, label: '30' },
              { value: 60, label: '60' },
            ]}
            onChange={(fps) => journeyActions.updateVideo({ fps })}
          />
        </div>
        <div>
          <FieldLabel>Format</FieldLabel>
          <Segmented
            label="Container format"
            size="sm"
            value={format}
            options={[
              { value: 'mp4', label: 'MP4' },
              { value: 'webm', label: 'WebM' },
            ]}
            onChange={setFormat}
          />
        </div>
      </div>

      <div className="mt-3 font-mono text-[10.5px] leading-relaxed text-faint">
        {preset.width}×{preset.height} · {frames} frames · ≈{estimateMb < 10 ? estimateMb.toFixed(1) : Math.round(estimateMb)} MB
      </div>

      <Button
        variant="primary"
        className="mt-4 h-11 w-full text-[12px]"
        disabled={disabled || !supported || running}
        onClick={start}
        data-testid="export"
      >
        EXPORT VIDEO
      </Button>
      {!supported && (
        <p className="mt-2 text-[11.5px] text-danger">
          This browser can’t encode video (no WebCodecs). Use a recent Chrome, Edge or Firefox.
        </p>
      )}

      {job && (
        <ExportDialog
          job={job}
          onCancel={() => abortRef.current?.abort()}
          onClose={() => setJob(null)}
          onRetry={start}
        />
      )}
    </Section>
  );
}

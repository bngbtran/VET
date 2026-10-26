import { useEffect, useRef } from 'react';
import { Button } from '../ui/controls';
import { DownloadIcon } from '../ui/icons';
import type { ExportJob } from './ExportPanel';

function formatRemaining(s: number | null): string {
  if (s === null) return 'Estimating…';
  if (s < 1) return 'Almost done';
  if (s < 60) return `${Math.ceil(s)} sec remaining`;
  return `${Math.floor(s / 60)} min ${String(Math.ceil(s % 60)).padStart(2, '0')} sec remaining`;
}

function formatSize(bytes: number): string {
  return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`;
}

const BAR = 24;

export function ExportDialog({
  job,
  onCancel,
  onClose,
  onRetry,
}: {
  job: ExportJob;
  onCancel: () => void;
  onClose: () => void;
  onRetry: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus(), [job.status]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (job.status === 'running') onCancel();
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [job.status, onCancel, onClose]);

  const progress = job.status === 'running' ? job.progress : null;
  const fraction = progress ? progress.frame / progress.totalFrames : job.status === 'done' ? 1 : 0;
  const filled = Math.round(fraction * BAR);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <div ref={dialogRef} className="w-[420px] rounded-lg bg-panel p-7 shadow-2xl ring-1 ring-line-strong" data-testid="export-dialog">
        <h2 id="export-title" className="font-mono text-[11px] tracking-[0.28em] text-muted">
          {job.status === 'done' ? 'VỆT READY' : job.status === 'error' ? 'EXPORT FAILED' : job.status === 'cancelled' ? 'EXPORT CANCELLED' : 'EXPORTING VỆT'}
        </h2>

        {(job.status === 'running' || job.status === 'done') && (
          <>
            <div className="mt-5 flex items-end justify-between">
              <span className="text-[40px] font-semibold leading-none tabular-nums" data-testid="export-percent">
                {Math.floor(fraction * 100)}%
              </span>
              <span className="font-mono text-[11px] text-muted">
                {progress?.stage === 'preparing' && 'Loading map…'}
                {progress?.stage === 'finalizing' && 'Finalizing file…'}
                {progress?.stage === 'rendering' && formatRemaining(progress.remaining)}
                {job.status === 'done' && `${job.result.seconds.toFixed(1)} s`}
              </span>
            </div>
            <div className="mt-4 font-mono text-[15px] tracking-[-0.05em] text-accent" aria-hidden="true">
              {'█'.repeat(filled)}
              <span className="text-white/12">{'░'.repeat(BAR - filled)}</span>
            </div>
            <div
              className="sr-only"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.floor(fraction * 100)}
            />
            <div className="mt-2 font-mono text-[11px] text-muted">
              {progress && `Frame ${progress.frame} / ${progress.totalFrames}`}
              {job.status === 'done' &&
                `${job.result.filename} · ${formatSize(job.result.blob.size)} · ${job.result.info.codec.toUpperCase()}`}
            </div>
          </>
        )}

        {job.status === 'running' && (
          <p className="mt-5 text-[11.5px] leading-relaxed text-faint">
            Keep this tab visible — browsers pause rendering in background tabs.
          </p>
        )}

        {job.status === 'error' && <p className="mt-4 text-[13px] leading-relaxed text-danger">{job.message}</p>}
        {job.status === 'cancelled' && <p className="mt-4 text-[13px] text-muted">Nothing was saved.</p>}

        <div className="mt-6 flex justify-end gap-2">
          {job.status === 'running' && (
            <Button data-autofocus className="h-9 px-4" onClick={onCancel} data-testid="export-cancel">
              Cancel
            </Button>
          )}
          {job.status === 'done' && (
            <>
              <Button variant="quiet" className="h-9 px-3" onClick={onClose}>
                Close
              </Button>
              <a
                data-autofocus
                href={job.url}
                download={job.result.filename}
                data-testid="download"
                className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-[12px] font-semibold tracking-[0.1em] text-ink hover:brightness-110"
              >
                <DownloadIcon size={14} /> DOWNLOAD VIDEO
              </a>
            </>
          )}
          {(job.status === 'error' || job.status === 'cancelled') && (
            <>
              <Button variant="quiet" className="h-9 px-3" onClick={onClose}>
                Close
              </Button>
              <Button data-autofocus className="h-9 px-4" onClick={onRetry}>
                Try again
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

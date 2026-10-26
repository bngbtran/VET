import { useEffect, useRef, useSyncExternalStore } from 'react';
import { formatTimecode } from '../../engine/animation/clock';
import { player } from '../../engine/animation/player';
import { PauseIcon, PlayIcon, RestartIcon } from '../ui/icons';

const subscribeStatus = (cb: () => void) => player.onStatus(cb);
const getPlaying = () => player.isPlaying;

/**
 * Play / pause / restart / seek. The scrubber and time readout are updated imperatively from
 * the player's frame stream — React never re-renders during playback.
 */
export function PlayerBar({ disabled }: { disabled: boolean }) {
  const playing = useSyncExternalStore(subscribeStatus, getPlaying);
  const rangeRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const durationRef = useRef<HTMLSpanElement>(null);

  useEffect(
    () =>
      player.onFrame((state) => {
        const range = rangeRef.current;
        if (range) {
          range.max = String(state.duration);
          range.value = String(state.time);
          range.style.setProperty('--fill', `${state.progress * 100}%`);
          range.setAttribute('aria-valuetext', `${formatTimecode(state.time)} of ${formatTimecode(state.duration)}`);
        }
        if (timeRef.current) timeRef.current.textContent = formatTimecode(state.time);
        if (durationRef.current) durationRef.current.textContent = formatTimecode(state.duration);
      }),
    [],
  );

  // Space toggles playback unless the user is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        player.toggle();
      } else if (e.key === 'Home') {
        player.seek(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-14 shrink-0 items-center gap-4 border-t border-line bg-panel px-5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => player.toggle()}
        aria-label={playing ? 'Pause' : 'Play'}
        data-testid="play"
        className="grid h-8 w-8 place-items-center rounded-full bg-fg text-ink transition hover:bg-white disabled:bg-white/10 disabled:text-faint"
      >
        {playing ? <PauseIcon size={13} /> : <PlayIcon size={13} className="translate-x-px" />}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => player.restart()}
        aria-label="Restart"
        className="text-muted hover:text-fg disabled:text-faint"
      >
        <RestartIcon size={15} />
      </button>
      <input
        ref={rangeRef}
        type="range"
        min={0}
        step={0.001}
        defaultValue={0}
        disabled={disabled}
        aria-label="Seek"
        data-testid="seek"
        className="vet-range min-w-0 flex-1"
        onInput={(e) => player.seek(Number(e.currentTarget.value))}
      />
      <div className="shrink-0 font-mono text-[12px] tabular-nums text-muted">
        <span ref={timeRef} className="text-fg" data-testid="current-time">
          00:00
        </span>
        {' / '}
        <span ref={durationRef}>00:00</span>
      </div>
    </div>
  );
}

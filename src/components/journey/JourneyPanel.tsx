import { formatDistance } from '../../engine/animation/state';
import type { JourneySegment, Place } from '../../models/journey';
import { TRANSPORT } from '../../models/transport';
import { ROUTE_COLORS } from '../../models/video';
import { formatJourneyDate } from '../../engine/animation/prepare';
import { DEFAULT_SEGMENT_SECONDS } from '../../engine/animation/timeline';
import { journeyActions, routeKey, useJourney } from '../../stores/journeyStore';
import { Section } from '../ui/controls';
import { CloseIcon, PlusIcon, SpinnerIcon, SwapIcon } from '../ui/icons';
import { LocationSearch } from './LocationSearch';
import { TransportPicker } from './TransportPicker';

const MAX_STOPS = 8;

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, '0')}`;
}

function segmentFor(segments: JourneySegment[], a: Place | null, b: Place | null) {
  if (!a || !b) return undefined;
  const same = (p: Place, q: Place) => p.latitude === q.latitude && p.longitude === q.longitude;
  return segments.find((s) => same(s.origin, a) && same(s.destination, b));
}

export function JourneyPanel() {
  const stops = useJourney((s) => s.journey.stops);
  const segments = useJourney((s) => s.journey.segments);
  const transports = useJourney((s) => s.transports);
  const date = useJourney((s) => s.journey.date ?? '');

  return (
    <Section
      title="JOURNEY"
      aside={
        <button
          type="button"
          className="text-faint hover:text-fg disabled:opacity-30"
          title="Reverse journey"
          aria-label="Reverse journey"
          disabled={stops.filter(Boolean).length < 2}
          onClick={journeyActions.reverse}
        >
          <SwapIcon size={14} />
        </button>
      }
    >
      <div className="flex flex-col">
        {stops.map((stop, i) => {
          const isFirst = i === 0;
          const isLast = i === stops.length - 1;
          const previous = stops.slice(0, i).reverse().find(Boolean) ?? stops.slice(i + 1).find(Boolean) ?? null;
          return (
            <div key={i}>
              <div className="flex items-center gap-1.5">
                <div className="min-w-0 flex-1">
                  <LocationSearch
                    label={isFirst ? 'From' : isLast ? 'To' : `Stop ${i}`}
                    marker={isFirst ? 'origin' : isLast ? 'destination' : 'stop'}
                    value={stop}
                    near={previous ?? undefined}
                    onChange={(p) => journeyActions.setStop(i, p)}
                  />
                </div>
                {stops.length > 2 && (
                  <button
                    type="button"
                    aria-label={`Remove stop ${i + 1}`}
                    className="text-faint hover:text-fg"
                    onClick={() => journeyActions.removeStop(i)}
                  >
                    <CloseIcon size={13} />
                  </button>
                )}
              </div>
              {!isLast && (
                <Leg
                  gap={i}
                  transport={transports[i] ?? 'car'}
                  segment={segmentFor(segments, stop, stops[i + 1] ?? null)}
                />
              )}
            </div>
          );
        })}
      </div>
      {stops.length < MAX_STOPS && (
        <button
          type="button"
          onClick={journeyActions.addStop}
          className="mt-3 flex items-center gap-2 text-[12px] text-muted hover:text-fg"
        >
          <PlusIcon size={13} /> Add stop
        </button>
      )}

      <label className="mt-4 flex items-center justify-between gap-3 text-[12px] text-muted">
        When
        <input
          type="month"
          value={date}
          aria-label="Journey month"
          onChange={(e) => journeyActions.setDate(e.target.value || null)}
          className="h-8 rounded-md bg-ink px-2 font-mono text-[12px] text-fg ring-1 ring-line outline-none focus:ring-accent/60"
        />
      </label>
    </Section>
  );
}

function Leg({ gap, transport, segment }: { gap: number; transport: JourneySegment['transport']; segment?: JourneySegment }) {
  const status = useJourney((s) => (segment ? s.routeStatus[routeKey(segment)] : undefined));
  // Per-leg colour and timing only make sense once there is more than one leg.
  const multiStop = useJourney((s) => s.journey.segments.length > 1);
  const perLeg = useJourney((s) => s.journey.videoSettings.segmentTiming === 'perSegment');
  const journeyColor = useJourney((s) => s.journey.videoSettings.routeColor);

  return (
    <div className="relative my-1 ml-[16px] border-l border-dashed border-line-strong py-2.5 pl-4">
      <TransportPicker value={transport} onChange={(m) => journeyActions.setTransport(gap, m)} />

      <div className="mt-2 min-h-[18px] font-mono text-[10.5px] tracking-wide text-muted">
        {!segment && <span className="text-faint">Choose both places</span>}
        {status?.state === 'loading' && (
          <span className="flex items-center gap-1.5">
            <SpinnerIcon size={11} /> Routing…
          </span>
        )}
        {status?.state === 'error' && (
          <span className="text-danger">
            {status.message}{' '}
            <button type="button" className="underline" onClick={() => journeyActions.retryRoute(segment!)}>
              Retry
            </button>
          </span>
        )}
        {segment?.route && !status && (
          <span data-testid="route-summary">
            {TRANSPORT[segment.transport].label.toUpperCase()} · {formatDistance(segment.route.distance)} ·{' '}
            {formatDuration(segment.route.estimatedDuration)}
            {segment.route.approximate && <span className="text-accent/80"> · approximate path</span>}
          </span>
        )}
      </div>

      {segment && multiStop && (
        <>
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <LegColor segment={segment} journeyColor={journeyColor} />
            {perLeg && <LegSeconds segment={segment} />}
          </div>
          <LegDate segment={segment} />
        </>
      )}
    </div>
  );
}

function LegColor({ segment, journeyColor }: { segment: JourneySegment; journeyColor: string }) {
  const current = segment.color ?? journeyColor;
  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Leg colour">
      {ROUTE_COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={current === c.value}
          aria-label={c.label}
          title={c.value === journeyColor ? `${c.label} (journey colour)` : c.label}
          // Picking the journey colour stores "follow the journey", so later changes carry over.
          onClick={() => journeyActions.setSegmentColor(segment.id, c.value === journeyColor ? null : c.value)}
          className={`h-3.5 w-3.5 rounded-full transition ${
            current === c.value ? 'ring-2 ring-fg ring-offset-2 ring-offset-panel' : 'opacity-60 hover:opacity-100'
          }`}
          style={{ background: c.value }}
        />
      ))}
    </div>
  );
}

function LegDate({ segment }: { segment: JourneySegment }) {
  const journeyDate = useJourney((s) => s.journey.date ?? null);
  const fallback = formatJourneyDate(journeyDate);
  return (
    <label className="mt-2 flex items-center gap-2 font-mono text-[11px] text-muted">
      <input
        type="month"
        value={segment.date ?? ''}
        aria-label="Month of this leg"
        onChange={(e) => journeyActions.setSegmentDate(segment.id, e.target.value || null)}
        className="h-7 rounded-md bg-ink px-2 text-[11.5px] text-fg ring-1 ring-line outline-none focus:ring-accent/60"
      />
      {!segment.date && fallback && <span className="text-faint">= {fallback}</span>}
    </label>
  );
}

function LegSeconds({ segment }: { segment: JourneySegment }) {
  return (
    <label className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
      <input
        type="number"
        min={1}
        max={120}
        step={0.5}
        value={segment.videoDuration ?? DEFAULT_SEGMENT_SECONDS}
        aria-label="Seconds of video for this leg"
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v > 0) journeyActions.setSegmentDuration(segment.id, Math.min(120, Math.max(1, v)));
        }}
        className="h-7 w-14 rounded-md bg-ink px-2 text-right text-[12px] text-fg ring-1 ring-line outline-none focus:ring-accent/60"
      />
      s
    </label>
  );
}

import type { PreparedJourney } from './prepare';

export type Phase =
  | { kind: 'intro'; start: number; end: number }
  | { kind: 'travel'; segment: number; start: number; end: number }
  /** Pause at an intermediate stop, between `segment` and `segment + 1`. */
  | { kind: 'hold'; segment: number; start: number; end: number }
  | { kind: 'outro'; start: number; end: number };

export interface Timeline {
  duration: number;
  phases: Phase[];
}

/**
 * Lays out the video: intro → travel(0) → hold → travel(1) → … → outro. Intro and outro shrink
 * on short videos so travel always gets most of the time.
 */
export function buildTimeline(journey: PreparedJourney, duration: number): Timeline {
  const n = journey.segments.length;
  const { overlays } = journey.settings;
  const intro = overlays.intro ? Math.min(2.2, duration * 0.12) : Math.min(0.6, duration * 0.04);
  const outro = overlays.outro ? Math.min(3.2, duration * 0.16) : Math.min(1, duration * 0.06);
  const hold = n > 1 ? Math.min(1.1, duration * 0.05) : 0;
  const travel = Math.max(0.1, duration - intro - outro - hold * (n - 1));

  const phases: Phase[] = [{ kind: 'intro', start: 0, end: intro }];
  const totalWeight = journey.segments.reduce((sum, s) => sum + s.weight, 0) || 1;
  let t = intro;
  journey.segments.forEach((seg, i) => {
    const len = (travel * seg.weight) / totalWeight;
    phases.push({ kind: 'travel', segment: i, start: t, end: t + len });
    t += len;
    if (i < n - 1) {
      phases.push({ kind: 'hold', segment: i, start: t, end: t + hold });
      t += hold;
    }
  });
  phases.push({ kind: 'outro', start: t, end: duration });
  return { duration, phases };
}

export function phaseAt(timeline: Timeline, time: number): Phase {
  const { phases } = timeline;
  for (const phase of phases) if (time < phase.end) return phase;
  return phases[phases.length - 1]!;
}

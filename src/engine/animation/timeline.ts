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

/** Seconds a leg gets in per-segment mode when the user hasn't set one. */
export const DEFAULT_SEGMENT_SECONDS = 6;

/** Per-segment timing applies only to multi-stop journeys. */
export function usesSegmentTiming(journey: PreparedJourney): boolean {
  return journey.settings.segmentTiming === 'perSegment' && journey.segments.length > 1;
}

/** Intro, outro and stop lengths for a video of roughly `duration` seconds. */
function framing(journey: PreparedJourney, duration: number) {
  const { overlays } = journey.settings;
  return {
    intro: overlays.intro ? Math.min(2.2, duration * 0.12) : Math.min(0.6, duration * 0.04),
    outro: overlays.outro ? Math.min(3.2, duration * 0.16) : Math.min(1, duration * 0.06),
    hold: journey.segments.length > 1 ? Math.min(1.1, duration * 0.05) : 0,
  };
}

/**
 * Lays out the video: intro → travel(0) → hold → travel(1) → … → outro.
 *
 * Total timing: `duration` is the whole video; intro and outro shrink on short videos and the
 * legs share what's left by weight. Per-segment timing: every leg gets exactly its own seconds
 * and the total duration follows from them.
 */
export function buildTimeline(journey: PreparedJourney, duration: number): Timeline {
  const n = journey.segments.length;
  let lengths: number[];
  let f: ReturnType<typeof framing>;

  if (usesSegmentTiming(journey)) {
    lengths = journey.segments.map((s) => Math.max(0.5, s.videoDuration ?? DEFAULT_SEGMENT_SECONDS));
    const travel = lengths.reduce((sum, l) => sum + l, 0);
    // Size the framing as if travel were ~70% of the video, like the automatic layout.
    f = framing(journey, travel / 0.7);
    duration = f.intro + f.outro + f.hold * (n - 1) + travel;
  } else {
    f = framing(journey, duration);
    const travel = Math.max(0.1, duration - f.intro - f.outro - f.hold * (n - 1));
    const totalWeight = journey.segments.reduce((sum, s) => sum + s.weight, 0) || 1;
    lengths = journey.segments.map((s) => (travel * s.weight) / totalWeight);
  }

  const phases: Phase[] = [{ kind: 'intro', start: 0, end: f.intro }];
  let t = f.intro;
  lengths.forEach((len, i) => {
    phases.push({ kind: 'travel', segment: i, start: t, end: t + len });
    t += len;
    if (i < n - 1) {
      phases.push({ kind: 'hold', segment: i, start: t, end: t + f.hold });
      t += f.hold;
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

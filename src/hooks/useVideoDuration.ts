import { useMemo } from 'react';
import { buildTimeline } from '../engine/animation/timeline';
import { usePreparedJourney } from './usePreparedJourney';

/** Effective video length in seconds — with per-leg timing it's the sum of the legs, not the preset. */
export function useVideoDuration(): number {
  const journey = usePreparedJourney();
  return useMemo(() => buildTimeline(journey, journey.settings.duration).duration, [journey]);
}

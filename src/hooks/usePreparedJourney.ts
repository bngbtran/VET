import { useMemo } from 'react';
import { prepareJourney, type PreparedJourney } from '../engine/animation/prepare';
import { useJourney } from '../stores/journeyStore';

/** The journey with measured routes and camera parameters; recomputed only when it changes. */
export function usePreparedJourney(): PreparedJourney {
  const journey = useJourney((s) => s.journey);
  return useMemo(() => prepareJourney(journey), [journey]);
}

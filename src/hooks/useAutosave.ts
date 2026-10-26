import { useEffect, useState } from 'react';
import { journeyActions, journeyStore } from '../stores/journeyStore';
import { lastProjectId, loadProject, saveProject } from '../stores/projectsDb';
import { describeError } from '../utils/errors';

export type SaveStatus = { state: 'idle' | 'saving' | 'saved' } | { state: 'error'; message: string };

/** Reopen the last project on startup, then save every change (debounced) to IndexedDB. */
export function useAutosave(): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>({ state: 'idle' });

  useEffect(() => {
    let cancelled = false;
    const id = lastProjectId();
    if (id) {
      loadProject(id)
        .then((j) => {
          if (j && !cancelled && journeyStore.get().revision === 0) journeyActions.load(j);
        })
        .catch((err) => setStatus({ state: 'error', message: describeError(err) }));
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let timer = 0;
    let lastRevision = journeyStore.get().revision;
    const unsubscribe = journeyStore.subscribe(() => {
      const { revision, journey } = journeyStore.get();
      if (revision === lastRevision) return;
      lastRevision = revision;
      // Don't litter the project list with empty journeys.
      if (!journey.stops.some(Boolean)) return;
      window.clearTimeout(timer);
      setStatus({ state: 'saving' });
      timer = window.setTimeout(() => {
        saveProject(journeyStore.get().journey)
          .then(() => setStatus({ state: 'saved' }))
          .catch((err) => setStatus({ state: 'error', message: describeError(err) }));
      }, 600);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return status;
}

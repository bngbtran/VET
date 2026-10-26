import type { Journey, JourneySegment, Place, VideoSettings } from '../models/journey';
import { createJourney, deriveSegments } from '../models/factory';
import type { TransportMode } from '../models/transport';
import { formatClock, parseClock, roundToFive } from '../engine/animation/clock';
import { prepareJourney } from '../engine/animation/prepare';
import { buildTimeline } from '../engine/animation/timeline';
import { getRoute } from '../providers/routing';
import { describeError, isAbortError } from '../utils/errors';
import { createStore, useStore } from './createStore';

export type RouteStatus = { state: 'loading' } | { state: 'error'; message: string };

export interface JourneyState {
  journey: Journey;
  /** Transport chosen for the gap after stop i (kept even before both stops exist). */
  transports: TransportMode[];
  /** Keyed by segment id; absent = idle/ready. */
  routeStatus: Record<string, RouteStatus>;
  /** Bumped on every user edit; drives autosave. */
  revision: number;
}

export const journeyStore = createStore<JourneyState>(initialState(createJourney()));

export const useJourney = <S>(selector: (s: JourneyState) => S) => useStore(journeyStore, selector);

function initialState(journey: Journey): JourneyState {
  return {
    journey,
    transports: transportsFor(journey),
    routeStatus: {},
    revision: 0,
  };
}

/** Reconstruct per-gap transports from a saved journey's segments. */
function transportsFor(journey: Journey): TransportMode[] {
  return journey.stops.slice(0, -1).map((origin, i) => {
    const dest = journey.stops[i + 1];
    const seg = journey.segments.find((s) => s.origin.id === origin?.id && s.destination.id === dest?.id);
    return seg?.transport ?? journey.segments[i]?.transport ?? 'car';
  });
}

const inflight = new Map<string, AbortController>();

/** Identifies one routing request: a segment can be re-requested with a different transport. */
export const routeKey = (seg: Pick<JourneySegment, 'id' | 'transport'>) => `${seg.id}:${seg.transport}`;

function commit(patch: (s: JourneyState) => { journey?: Partial<Journey>; transports?: TransportMode[] }) {
  journeyStore.set((s) => {
    const p = patch(s);
    const journey = { ...s.journey, ...p.journey, updatedAt: Date.now() };
    const transports = p.transports ?? s.transports;
    if (p.journey?.stops || p.transports) {
      journey.segments = deriveSegments(journey.stops, transports, s.journey.segments);
    }
    return { journey, transports, revision: s.revision + 1 };
  });
  requestRoutes();
}

/** Fetch routes for every segment that doesn't have one yet; cancel fetches for removed ones. */
function requestRoutes() {
  const { journey } = journeyStore.get();
  const live = new Set(journey.segments.filter((s) => !s.route).map(routeKey));
  for (const [key, ctrl] of inflight) {
    if (!live.has(key)) {
      ctrl.abort();
      inflight.delete(key);
      setStatus(key, null);
    }
  }
  for (const seg of journey.segments) {
    const key = routeKey(seg);
    if (seg.route || inflight.has(key)) continue;
    if (journeyStore.get().routeStatus[key]?.state === 'error') continue;
    void fetchRoute(seg);
  }
}

async function fetchRoute(seg: JourneySegment) {
  const key = routeKey(seg);
  const ctrl = new AbortController();
  inflight.set(key, ctrl);
  setStatus(key, { state: 'loading' });
  try {
    const route = await getRoute({ origin: seg.origin, destination: seg.destination, transport: seg.transport, signal: ctrl.signal });
    journeyStore.set((s) => {
      const index = s.journey.segments.findIndex((x) => x.id === seg.id && x.transport === seg.transport);
      if (index === -1) return {};
      const segments = s.journey.segments.slice();
      segments[index] = withDefaultTimes({ ...segments[index]!, route }, segments[index - 1]);
      return { journey: { ...s.journey, segments }, revision: s.revision + 1 };
    });
    setStatus(key, null);
  } catch (err) {
    if (isAbortError(err) && ctrl.signal.aborted) return;
    setStatus(key, { state: 'error', message: describeError(err) });
  } finally {
    if (inflight.get(key) === ctrl) inflight.delete(key);
  }
}

/** Fill in clock times the user hasn't set: depart 08:00 (or when the previous leg arrives). */
function withDefaultTimes(seg: JourneySegment, previous: JourneySegment | undefined): JourneySegment {
  const start = seg.startTime ?? previous?.endTime ?? '08:00';
  const startMin = parseClock(start)!;
  const end = seg.endTime ?? formatClock(roundToFive(startMin + (seg.route?.estimatedDuration ?? 0) / 60));
  return { ...seg, startTime: start, endTime: end };
}

function setStatus(id: string, status: RouteStatus | null) {
  journeyStore.set((s) => {
    const routeStatus = { ...s.routeStatus };
    if (status) routeStatus[id] = status;
    else delete routeStatus[id];
    return { routeStatus };
  });
}

export const journeyActions = {
  setName(name: string) {
    commit(() => ({ journey: { name } }));
  },

  /** "YYYY-MM", or null to clear. */
  setDate(date: string | null) {
    commit(() => ({ journey: { date } }));
  },

  setStop(index: number, place: Place | null) {
    commit((s) => {
      const stops = s.journey.stops.slice();
      stops[index] = place;
      return { journey: { stops, ...(index === 0 || index === stops.length - 1 ? autoName(stops, s.journey) : {}) } };
    });
  },

  addStop() {
    commit((s) => ({
      journey: { stops: [...s.journey.stops, null] },
      transports: [...s.transports, s.transports[s.transports.length - 1] ?? 'car'],
    }));
  },

  removeStop(index: number) {
    commit((s) => {
      if (s.journey.stops.length <= 2) {
        const stops = s.journey.stops.slice();
        stops[index] = null;
        return { journey: { stops } };
      }
      const stops = s.journey.stops.filter((_, i) => i !== index);
      const transports = s.transports.filter((_, i) => i !== Math.min(index, s.transports.length - 1));
      return { journey: { stops }, transports };
    });
  },

  /** Swap the order of the whole journey. */
  reverse() {
    commit((s) => ({
      journey: { stops: s.journey.stops.slice().reverse() },
      transports: s.transports.slice().reverse(),
    }));
  },

  setTransport(gap: number, mode: TransportMode) {
    commit((s) => {
      const transports = s.transports.slice();
      transports[gap] = mode;
      return { transports };
    });
  },

  /** Vệt colour for one leg; null = use the journey colour. */
  setSegmentColor(segmentId: string, color: string | null) {
    commit((s) => ({
      journey: { segments: s.journey.segments.map((seg) => (seg.id === segmentId ? { ...seg, color } : seg)) },
    }));
  },

  /** Month for one leg, "YYYY-MM"; null = use the journey's date. */
  setSegmentDate(segmentId: string, date: string | null) {
    commit((s) => ({
      journey: { segments: s.journey.segments.map((seg) => (seg.id === segmentId ? { ...seg, date } : seg)) },
    }));
  },

  /** Seconds of video for one leg (per-segment timing). */
  setSegmentDuration(segmentId: string, seconds: number) {
    commit((s) => ({
      journey: {
        segments: s.journey.segments.map((seg) => (seg.id === segmentId ? { ...seg, videoDuration: seconds } : seg)),
      },
    }));
  },

  /**
   * Switch between one total duration and per-leg durations. Entering per-leg mode seeds every
   * leg with the length it currently gets, so the video doesn't change until the user edits it.
   */
  setSegmentTiming(mode: 'total' | 'perSegment') {
    commit((s) => {
      const { journey } = s;
      const videoSettings = { ...journey.videoSettings, segmentTiming: mode };
      if (mode === 'total') return { journey: { videoSettings } };
      const prepared = prepareJourney({ ...journey, videoSettings: { ...videoSettings, segmentTiming: 'total' } });
      const timeline = buildTimeline(prepared, journey.videoSettings.duration);
      const current = new Map<string, number>();
      for (const phase of timeline.phases) {
        if (phase.kind !== 'travel') continue;
        const seconds = Math.max(1, Math.round((phase.end - phase.start) * 2) / 2);
        current.set(prepared.segments[phase.segment]!.id, seconds);
      }
      return {
        journey: {
          videoSettings,
          segments: journey.segments.map((seg) => ({ ...seg, videoDuration: seg.videoDuration ?? current.get(seg.id) ?? null })),
        },
      };
    });
  },

  /** Retry a segment whose route failed. */
  retryRoute(segment: JourneySegment) {
    setStatus(routeKey(segment), null);
    requestRoutes();
  },

  updateVideo(patch: Partial<VideoSettings>) {
    commit((s) => ({ journey: { videoSettings: { ...s.journey.videoSettings, ...patch } } }));
  },

  updateOverlays(patch: Partial<VideoSettings['overlays']>) {
    commit((s) => ({
      journey: { videoSettings: { ...s.journey.videoSettings, overlays: { ...s.journey.videoSettings.overlays, ...patch } } },
    }));
  },

  /** Replace the whole journey (new / open / import). */
  load(journey: Journey) {
    for (const ctrl of inflight.values()) ctrl.abort();
    inflight.clear();
    journeyStore.set({ ...initialState(journey), revision: journeyStore.get().revision + 1 });
    requestRoutes();
  },
};

/** Keep an untouched default name in sync with the endpoints: "Đà Nẵng → Huế". */
function autoName(stops: (Place | null)[], journey: Journey): Partial<Journey> {
  const first = stops[0];
  const last = stops[stops.length - 1];
  const prevAuto = [journey.stops[0]?.name, journey.stops[journey.stops.length - 1]?.name].filter(Boolean).join(' → ');
  const isAuto = journey.name === 'Untitled journey' || journey.name === prevAuto;
  if (!isAuto) return {};
  const name = [first?.name, last?.name].filter(Boolean).join(' → ');
  return name ? { name } : {};
}

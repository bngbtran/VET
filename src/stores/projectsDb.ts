import { DEFAULT_VIDEO_SETTINGS } from '../models/factory';
import { PROJECT_FILE_VERSION, type Journey, type ProjectFile } from '../models/journey';
import { TRANSPORT_MODES } from '../models/transport';
import { AppError } from '../utils/errors';
import { createId } from '../utils/id';

/** Projects live only in this browser's IndexedDB — no server, no sync. */
const DB_NAME = 'vet';
const STORE = 'projects';
const LAST_KEY = 'vet:last-project';

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(new AppError('storage-failed', 'Local project storage is unavailable (private window?).', req.error?.message));
    };
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new AppError('storage-failed', 'Could not access local projects.', req.error?.message));
  });
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const all = await tx<Journey[]>('readonly', (s) => s.getAll());
  return all
    .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveProject(journey: Journey): Promise<void> {
  await tx('readwrite', (s) => s.put(journey));
  rememberLast(journey.id);
}

export async function loadProject(id: string): Promise<Journey | null> {
  const j = await tx<Journey | undefined>('readonly', (s) => s.get(id));
  return j ? normalizeJourney(j) : null;
}

export async function deleteProject(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export function lastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

export function rememberLast(id: string) {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* storage blocked — not critical */
  }
}

export function duplicateJourney(journey: Journey): Journey {
  const now = Date.now();
  return { ...structuredClone(journey), id: createId('j'), name: `${journey.name} (copy)`, createdAt: now, updatedAt: now };
}

// ── JSON project files ───────────────────────────────────────────────────────

export function toProjectFile(journey: Journey): Blob {
  const file: ProjectFile = { app: 'vet', version: PROJECT_FILE_VERSION, journey };
  return new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
}

export async function fromProjectFile(file: File): Promise<Journey> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new AppError('invalid-project', `“${file.name}” is not a valid JSON file.`);
  }
  const f = data as Partial<ProjectFile>;
  if (f?.app !== 'vet' || typeof f.version !== 'number' || !f.journey) {
    throw new AppError('invalid-project', `“${file.name}” is not a Vệt project file.`);
  }
  if (f.version > PROJECT_FILE_VERSION) {
    throw new AppError('invalid-project', 'This project was saved by a newer version of Vệt.');
  }
  const journey = normalizeJourney(f.journey);
  // Imported projects never overwrite an existing one.
  return { ...journey, id: createId('j'), updatedAt: Date.now() };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validate and fill defaults, so old or hand-edited files can't crash the app. */
function normalizeJourney(raw: Journey): Journey {
  const bad = () => new AppError('invalid-project', 'The project file is damaged or incomplete.');
  if (!raw || !Array.isArray(raw.stops) || !Array.isArray(raw.segments)) throw bad();
  const placeOk = (p: unknown) =>
    p === null || (typeof p === 'object' && isNum((p as { latitude: unknown }).latitude) && isNum((p as { longitude: unknown }).longitude));
  if (!raw.stops.every(placeOk)) throw bad();
  for (const s of raw.segments) {
    if (!placeOk(s.origin) || !placeOk(s.destination) || !TRANSPORT_MODES.includes(s.transport)) throw bad();
    if (s.route && (!Array.isArray(s.route.coordinates) || !s.route.coordinates.every((c) => Array.isArray(c) && isNum(c[0]) && isNum(c[1])))) {
      throw bad();
    }
  }
  const stops = raw.stops.length >= 2 ? raw.stops : [...raw.stops, ...Array(2 - raw.stops.length).fill(null)];
  return {
    ...raw,
    id: typeof raw.id === 'string' ? raw.id : createId('j'),
    name: typeof raw.name === 'string' ? raw.name : 'Untitled journey',
    createdAt: isNum(raw.createdAt) ? raw.createdAt : Date.now(),
    updatedAt: isNum(raw.updatedAt) ? raw.updatedAt : Date.now(),
    stops,
    date: typeof raw.date === 'string' && /^\d{4}-\d{2}$/.test(raw.date) ? raw.date : null,
    videoSettings: {
      ...DEFAULT_VIDEO_SETTINGS,
      ...raw.videoSettings,
      overlays: { ...DEFAULT_VIDEO_SETTINGS.overlays, ...raw.videoSettings?.overlays },
    },
  };
}

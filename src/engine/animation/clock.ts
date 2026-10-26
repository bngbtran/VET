/** "HH:MM" → minutes since midnight, or null if absent/invalid. */
export function parseClock(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function formatClock(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Seconds → "MM:SS" for the player. */
export function formatTimecode(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds + 1e-6));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Round minutes to the nearest 5 for friendlier default arrival times. */
export function roundToFive(minutes: number): number {
  return Math.round(minutes / 5) * 5;
}

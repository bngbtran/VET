import type { TransportMode } from '../../models/transport';

/**
 * Top-down vehicle silhouettes, nose pointing north (up), in a 64×64 box. Drawn as vectors so
 * they stay sharp at any output resolution.
 */
const BODY = '#f4f1ea';
const LINE = '#0b0c0e';

const SHAPES: Record<TransportMode, string> = {
  car: `
    <rect x="21" y="10" width="22" height="44" rx="8" fill="${BODY}" stroke="${LINE}" stroke-width="2.5"/>
    <path d="M24.5 23 Q32 19.5 39.5 23 L38 29 Q32 27.5 26 29 Z" fill="${LINE}" opacity=".85"/>
    <path d="M26 44 Q32 45.5 38 44 L39 48 Q32 50 25 48 Z" fill="${LINE}" opacity=".7"/>`,
  motorcycle: `
    <rect x="28.5" y="8" width="7" height="13" rx="3.5" fill="${LINE}"/>
    <rect x="28.5" y="43" width="7" height="13" rx="3.5" fill="${LINE}"/>
    <path d="M20 21 H44" stroke="${LINE}" stroke-width="3.5" stroke-linecap="round"/>
    <rect x="25" y="18" width="14" height="30" rx="7" fill="${BODY}" stroke="${LINE}" stroke-width="2.5"/>
    <circle cx="32" cy="31" r="4.2" fill="${LINE}" opacity=".85"/>`,
  bicycle: `
    <rect x="29.5" y="7" width="5" height="17" rx="2.5" fill="${LINE}"/>
    <rect x="29.5" y="40" width="5" height="17" rx="2.5" fill="${LINE}"/>
    <path d="M32 14 V50" stroke="${BODY}" stroke-width="5" stroke-linecap="round"/>
    <path d="M32 14 V50" stroke="${LINE}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M21 18 H43" stroke="${BODY}" stroke-width="5" stroke-linecap="round"/>
    <path d="M21 18 H43" stroke="${LINE}" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="32" cy="34" r="5.5" fill="${BODY}" stroke="${LINE}" stroke-width="2.2"/>`,
  walking: `
    <circle cx="32" cy="32" r="15" fill="${BODY}" fill-opacity=".22" stroke="${BODY}" stroke-width="2"/>
    <circle cx="32" cy="32" r="8" fill="${BODY}" stroke="${LINE}" stroke-width="2.5"/>`,
  train: `
    <rect x="23" y="4" width="18" height="56" rx="8" fill="${BODY}" stroke="${LINE}" stroke-width="2.5"/>
    <path d="M26 14 Q32 10.5 38 14 V19 H26 Z" fill="${LINE}" opacity=".85"/>
    <path d="M23 32 H41 M23 46 H41" stroke="${LINE}" stroke-width="1.8" opacity=".7"/>`,
  airplane: `
    <path d="M32 4 C34.6 4 35.8 7.5 35.8 11 V25 L58 38 V43.5 L35.8 36.5 V50 L43 55.5 V60 L32 57 L21 60 V55.5 L28.2 50 V36.5 L6 43.5 V38 L28.2 25 V11 C28.2 7.5 29.4 4 32 4 Z"
      fill="${BODY}" stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round"/>`,
};

export function vehicleSvg(mode: TransportMode): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256">${SHAPES[mode]}</svg>`;
}

let cache: Promise<Map<TransportMode, HTMLImageElement>> | null = null;

/** Decoded vehicle images, loaded once and shared by the preview and the exporter. */
export function loadVehicleImages(): Promise<Map<TransportMode, HTMLImageElement>> {
  cache ??= Promise.all(
    (Object.keys(SHAPES) as TransportMode[]).map(async (mode) => {
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(vehicleSvg(mode))}`;
      await img.decode();
      return [mode, img] as const;
    }),
  ).then((entries) => new Map(entries));
  return cache;
}

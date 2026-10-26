import { useId } from 'react';
import { BRAND } from './brand';

/** Brand amber, fixed for the app icon (the wordmark uses the accent token). */
const BRAND_AMBER = '#f2b45a';

/**
 * Path of the V. It leaves the start point just outside its ring (so the hollow point is truly
 * hollow on any background), swings down, rounds the bottom and rises to the end point.
 */
const vPath = (sx: number, sy: number) =>
  `M${sx} ${sy} C ${sx + 1.6} ${sy + 3.8}, 9.2 16.4, 11.9 20.3 C 13 21.9, 14.7 21.9, 15.8 20.3 C 18.6 16, 20.6 9.8, 23.8 4.2`;

/**
 * The Vệt "V": a journey drawn as a letter. A hollow point where it starts, one continuous
 * trace that gathers strength as it goes, and a solid point where it arrives. Sized in em so it
 * sits with the surrounding text. Colour defaults to the accent token.
 */
export function VMark({
  className = '',
  weight = 'text',
  color = 'var(--color-accent)',
}: {
  className?: string;
  weight?: 'text' | 'icon';
  color?: string;
}) {
  const id = useId();
  // The icon variant is heavier so it survives at favicon sizes.
  const icon = weight === 'icon';
  const stroke = icon ? 3.3 : 3;
  return (
    <svg
      viewBox="0 0 28 24"
      className={className}
      style={{ height: '0.9em', width: '1.05em', position: 'relative', top: '0.06em', overflow: 'visible' }}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="4" y1="4" x2="24" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: color, stopOpacity: icon ? 0.75 : 0.62 }} />
          <stop offset="0.5" style={{ stopColor: color, stopOpacity: 0.9 }} />
          <stop offset="1" style={{ stopColor: color }} />
        </linearGradient>
      </defs>
      <path d={icon ? vPath(6.01, 8.39) : vPath(5.71, 7.76)} stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round" />
      <circle cx="4.2" cy="4.6" r={icon ? 2.8 : 2.2} style={{ stroke: color }} strokeWidth={stroke * 0.65} />
      <circle cx="23.8" cy="4.2" r={icon ? 3.5 : 2.9} style={{ fill: color }} />
    </svg>
  );
}

/** "VỆT": the traced V in amber, ỆT in the text colour, set in soft Fraunces. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline ${className}`} aria-label={BRAND.wordmark} role="img">
      <VMark className="mr-[0.14em]" />
      <span className="font-display tracking-[0.1em] text-fg" aria-hidden="true">
        ỆT
      </span>
    </span>
  );
}

/** The V alone on a dark tile — favicon / app icon. */
export function AppIcon({ size = 64 }: { size?: number }) {
  return (
    <span
      className="inline-grid place-items-center bg-[#0b0c0e]"
      style={{ width: size, height: size, borderRadius: size * 0.22, fontSize: size * 0.56 }}
    >
      <VMark weight="icon" color={BRAND_AMBER} />
    </span>
  );
}

/** The creator credit: name in italic (white on dark), linking to their email. */
export function CreatorLink({ className = '' }: { className?: string }) {
  return (
    <a
      href={`mailto:${BRAND.creatorEmail}`}
      title={BRAND.creatorEmail}
      className={`font-display italic text-fg underline-offset-4 transition-colors hover:text-accent hover:underline ${className}`}
    >
      {BRAND.creator}
    </a>
  );
}

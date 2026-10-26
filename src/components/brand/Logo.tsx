import { useId } from 'react';
import { BRAND } from './brand';

const AMBER = '#f2b45a';

/**
 * The Vệt "V": a journey drawn as a letter. A hollow point where it starts, one continuous
 * trace that swings down, rounds the bottom and rises — gathering strength as it goes — to a
 * solid point where it arrives. Sized in em so it sits with the surrounding text.
 */
export function VMark({ className = '', weight = 'text' }: { className?: string; weight?: 'text' | 'icon' }) {
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
          <stop offset="0" stopColor={AMBER} stopOpacity={icon ? 0.75 : 0.62} />
          <stop offset="0.5" stopColor={AMBER} stopOpacity="0.9" />
          <stop offset="1" stopColor={AMBER} />
        </linearGradient>
      </defs>
      <path
        d="M4.2 4.6 C 6.4 9.2, 8.9 16, 11.9 20.3 C 13 21.9, 14.7 21.9, 15.8 20.3 C 18.6 16, 20.6 9.8, 23.8 4.2"
        stroke={`url(#${id})`}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <circle cx="4.2" cy="4.6" r={icon ? 2.8 : 2.2} fill="#0b0c0e" stroke={AMBER} strokeWidth={stroke * 0.65} />
      <circle cx="23.8" cy="4.2" r={icon ? 3.5 : 2.9} fill={AMBER} />
    </svg>
  );
}

/** "VỆT": the traced V in amber, ỆT in ivory set in soft Fraunces. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline ${className}`} aria-label={BRAND.wordmark} role="img">
      <VMark className="mr-[0.14em]" />
      <span className="font-display tracking-[0.1em] text-[#f4f1ea]" aria-hidden="true">
        ỆT
      </span>
    </span>
  );
}

/** The V alone on an ink tile — favicon / app icon. */
export function AppIcon({ size = 64 }: { size?: number }) {
  return (
    <span
      className="inline-grid place-items-center bg-ink"
      style={{ width: size, height: size, borderRadius: size * 0.22, fontSize: size * 0.56 }}
    >
      <VMark weight="icon" />
    </span>
  );
}

/** The creator credit: name in white italic, linking to their email. */
export function CreatorLink({ className = '' }: { className?: string }) {
  return (
    <a
      href={`mailto:${BRAND.creatorEmail}`}
      title={BRAND.creatorEmail}
      className={`font-display italic text-[#f4f1ea] underline-offset-4 transition-colors hover:text-accent hover:underline ${className}`}
    >
      {BRAND.creator}
    </a>
  );
}

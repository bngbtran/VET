import type { ReactNode, SVGProps } from 'react';
import type { TransportMode } from '../../models/transport';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />
  </Svg>
);
export const PauseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z" fill="currentColor" stroke="none" />
  </Svg>
);
export const RestartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4h4" />
  </Svg>
);
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const SwapIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4" />
  </Svg>
);
export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </Svg>
);
export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
  </Svg>
);
export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
export const SpinnerIcon = (p: IconProps) => (
  <Svg {...p} className={`animate-spin ${p.className ?? ''}`}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </Svg>
);

const TRANSPORT_PATHS: Record<TransportMode, ReactNode> = {
  car: (
    <>
      <path d="M5 16V11.5L7 7h10l2 4.5V16" />
      <path d="M3.5 16h17v2.5h-17z" />
      <circle cx="7.5" cy="18.5" r="1.4" />
      <circle cx="16.5" cy="18.5" r="1.4" />
      <path d="M5 11.5h14" />
    </>
  ),
  motorcycle: (
    <>
      <circle cx="5.5" cy="16.5" r="3" />
      <circle cx="18.5" cy="16.5" r="3" />
      <path d="M5.5 16.5L9 11h5l2.5 5.5M14 11l-1.5-3H10M16 8h2.5l-2 8.5" />
    </>
  ),
  bicycle: (
    <>
      <circle cx="5.5" cy="16.5" r="3.5" />
      <circle cx="18.5" cy="16.5" r="3.5" />
      <path d="M5.5 16.5L9 9h6l3.5 7.5M9 9l3 7.5h-6.5M15 9l-1-2.5h2.5" />
    </>
  ),
  walking: (
    <>
      <circle cx="13" cy="4.5" r="1.6" />
      <path d="M10 21l2-6 2.5 2.5V21M12 15l-.5-5.5L8 11l-1 3M11.5 9.5l3 2.5 2.5.5" />
    </>
  ),
  train: (
    <>
      <rect x="6" y="3.5" width="12" height="13.5" rx="3" />
      <path d="M6 10.5h12M9 20.5l1.5-3.5M15 20.5L13.5 17" />
      <circle cx="9.5" cy="13.8" r=".6" fill="currentColor" />
      <circle cx="14.5" cy="13.8" r=".6" fill="currentColor" />
    </>
  ),
  airplane: (
    <path d="M12 3c.9 0 1.4 1 1.4 2.2V10l7 4.2v1.9l-7-2.1v4.2l2.2 1.7v1.6L12 20.5l-3.6 1v-1.6l2.2-1.7V14l-7 2.1v-1.9l7-4.2V5.2C10.6 4 11.1 3 12 3z" />
  ),
};

export function TransportIcon({ mode, ...p }: IconProps & { mode: TransportMode }) {
  return <Svg {...p}>{TRANSPORT_PATHS[mode]}</Svg>;
}

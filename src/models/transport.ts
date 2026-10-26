export const TRANSPORT_MODES = ['car', 'motorcycle', 'bicycle', 'walking', 'train', 'airplane'] as const;

export type TransportMode = (typeof TRANSPORT_MODES)[number];

export interface TransportInfo {
  mode: TransportMode;
  label: string;
  /** Whether the vehicle icon turns to follow the route bearing. */
  rotates: boolean;
}

export const TRANSPORT: Record<TransportMode, TransportInfo> = {
  car: { mode: 'car', label: 'Car', rotates: true },
  motorcycle: { mode: 'motorcycle', label: 'Motorbike', rotates: true },
  bicycle: { mode: 'bicycle', label: 'Bicycle', rotates: true },
  walking: { mode: 'walking', label: 'Walking', rotates: false },
  train: { mode: 'train', label: 'Train', rotates: true },
  airplane: { mode: 'airplane', label: 'Airplane', rotates: true },
};

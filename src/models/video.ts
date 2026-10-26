export interface QualityPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const QUALITY_PRESETS: QualityPreset[] = [
  { id: '720p', label: '720p', width: 1280, height: 720 },
  { id: '1080p', label: '1080p', width: 1920, height: 1080 },
  { id: '1440p', label: '1440p', width: 2560, height: 1440 },
  { id: '4k', label: '4K', width: 3840, height: 2160 },
];

export const DURATION_PRESETS = [5, 10, 15, 20, 30, 60];

export const MIN_DURATION = 3;
export const MAX_DURATION = 180;

/**
 * Every camera calculation happens in this logical viewport. The preview applies a zoom
 * offset for its actual size and the exporter scales with pixelRatio, so framing is identical
 * at any output resolution.
 */
export const REFERENCE_VIEWPORT = { width: 1920, height: 1080 } as const;

export const ROUTE_COLORS = [
  { id: 'amber', label: 'Amber', value: '#f2b45a' },
  { id: 'ivory', label: 'Ivory', value: '#f4f1ea' },
  { id: 'coral', label: 'Coral', value: '#ff6b57' },
  { id: 'cyan', label: 'Cyan', value: '#5ad1f2' },
  { id: 'lime', label: 'Lime', value: '#b8f25a' },
];

import { useState } from 'react';
import type { CameraMode } from '../../models/journey';
import { DURATION_PRESETS, MAX_DURATION, MIN_DURATION, ROUTE_COLORS } from '../../models/video';
import { MAP_STYLES } from '../../providers/maps/styles';
import { journeyActions, useJourney } from '../../stores/journeyStore';
import { FieldLabel, Section, Segmented, Toggle } from '../ui/controls';

const CAMERA_OPTIONS: { value: CameraMode; label: string; title: string }[] = [
  { value: 'cinematic', label: 'Cinematic', title: 'Establishing shot, pitched follow, arrival and reveal' },
  { value: 'follow', label: 'Follow', title: 'Top-down, centred on the vehicle' },
  { value: 'static', label: 'Static', title: 'Whole journey in frame' },
];

export function VideoPanel() {
  const video = useJourney((s) => s.journey.videoSettings);
  const isPreset = DURATION_PRESETS.includes(video.duration);
  const [custom, setCustom] = useState(!isPreset);

  return (
    <>
      <Section title="DURATION">
        <div className="grid grid-cols-7 gap-1">
          {DURATION_PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={!custom && video.duration === d}
              onClick={() => {
                setCustom(false);
                journeyActions.updateVideo({ duration: d });
              }}
              className={`h-7 rounded-md font-mono text-[11.5px] transition ${
                !custom && video.duration === d ? 'bg-raised text-fg ring-1 ring-line-strong' : 'text-muted hover:text-fg'
              }`}
            >
              {d}s
            </button>
          ))}
          <button
            type="button"
            aria-pressed={custom}
            onClick={() => setCustom(true)}
            className={`h-7 rounded-md text-[11px] transition ${custom ? 'bg-raised text-fg ring-1 ring-line-strong' : 'text-muted hover:text-fg'}`}
          >
            ···
          </button>
        </div>
        {custom && (
          <label className="mt-2.5 flex items-center gap-2 text-[12px] text-muted">
            Custom
            <input
              type="number"
              min={MIN_DURATION}
              max={MAX_DURATION}
              step={1}
              value={video.duration}
              aria-label="Custom duration in seconds"
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) journeyActions.updateVideo({ duration: Math.max(MIN_DURATION, Math.min(MAX_DURATION, v)) });
              }}
              className="h-7 w-16 rounded-md bg-ink px-2 font-mono text-[12px] text-fg ring-1 ring-line outline-none focus:ring-accent/60"
            />
            seconds
          </label>
        )}
      </Section>

      <Section title="CAMERA">
        <Segmented
          label="Camera mode"
          value={video.cameraMode}
          options={CAMERA_OPTIONS}
          onChange={(cameraMode) => journeyActions.updateVideo({ cameraMode })}
        />
      </Section>

      <Section title="LOOK">
        <FieldLabel>Map style</FieldLabel>
        <div className="mb-4 grid grid-cols-3 gap-1">
          {MAP_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={video.mapStyle === s.id}
              onClick={() => journeyActions.updateVideo({ mapStyle: s.id })}
              className={`flex h-8 items-center gap-2 rounded-md px-2 text-[12px] transition ${
                video.mapStyle === s.id ? 'bg-raised text-fg ring-1 ring-line-strong' : 'text-muted hover:text-fg'
              }`}
            >
              <span className={`h-3 w-3 rounded-sm ring-1 ring-white/15 ${s.tone === 'dark' ? 'bg-[#1d1f24]' : 'bg-[#e9e7e1]'}`} />
              {s.label}
            </button>
          ))}
        </div>

        <FieldLabel>Vệt colour</FieldLabel>
        <div className="mb-4 flex gap-2" role="radiogroup" aria-label="Route colour">
          {ROUTE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={video.routeColor === c.value}
              aria-label={c.label}
              title={c.label}
              onClick={() => journeyActions.updateVideo({ routeColor: c.value })}
              className={`h-6 w-6 rounded-full transition ${
                video.routeColor === c.value ? 'ring-2 ring-fg ring-offset-2 ring-offset-panel' : 'opacity-70 hover:opacity-100'
              }`}
              style={{ background: c.value }}
            />
          ))}
        </div>

        <FieldLabel>Overlays</FieldLabel>
        <Toggle label="Intro title" checked={video.overlays.intro} onChange={(intro) => journeyActions.updateOverlays({ intro })} />
        <Toggle label="Arrival title" checked={video.overlays.outro} onChange={(outro) => journeyActions.updateOverlays({ outro })} />
        <Toggle label="Caption & clock" checked={video.overlays.caption} onChange={(caption) => journeyActions.updateOverlays({ caption })} />
        <Toggle label="Place labels" checked={video.overlays.labels} onChange={(labels) => journeyActions.updateOverlays({ labels })} />
      </Section>
    </>
  );
}

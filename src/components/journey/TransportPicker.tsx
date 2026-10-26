import { TRANSPORT, TRANSPORT_MODES, type TransportMode } from '../../models/transport';
import { TransportIcon } from '../ui/icons';

export function TransportPicker({ value, onChange }: { value: TransportMode; onChange: (m: TransportMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Transport" className="grid grid-cols-6 gap-1">
      {TRANSPORT_MODES.map((mode) => {
        const active = mode === value;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={TRANSPORT[mode].label}
            title={TRANSPORT[mode].label}
            onClick={() => onChange(mode)}
            className={`grid h-8 place-items-center rounded-md transition ${
              active ? 'bg-accent/15 text-accent ring-1 ring-accent/40' : 'text-muted hover:bg-hover hover:text-fg'
            }`}
          >
            <TransportIcon mode={mode} size={17} />
          </button>
        );
      })}
    </div>
  );
}

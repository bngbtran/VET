import { useEffect, useId, useRef, useState } from 'react';
import type { Place } from '../../models/journey';
import { geocoder } from '../../providers/geocoding';
import { AppError, describeError, isAbortError } from '../../utils/errors';
import { CloseIcon, SearchIcon, SpinnerIcon } from '../ui/icons';

interface Props {
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  near?: { latitude: number; longitude: number };
  marker: 'origin' | 'stop' | 'destination';
  autoFocus?: boolean;
}

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; places: Place[] }
  | { kind: 'error'; message: string };

export function LocationSearch({ label, value, onChange, near, marker, autoFocus }: Props) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [searchResult, setSearch] = useState<SearchState>({ kind: 'idle' });
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const nearLat = near?.latitude;
  const nearLng = near?.longitude;

  // Debounced autocomplete; each keystroke cancels the previous request.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearch({ kind: 'loading' });
      try {
        const places = await geocoder.search({
          text,
          near: nearLat !== undefined && nearLng !== undefined ? { latitude: nearLat, longitude: nearLng } : undefined,
          signal: ctrl.signal,
        });
        setActive(0);
        setSearch(
          places.length
            ? { kind: 'results', places }
            : { kind: 'error', message: new AppError('location-not-found', `No places match “${text}”.`).message },
        );
      } catch (err) {
        if (isAbortError(err) && ctrl.signal.aborted) return;
        setSearch({ kind: 'error', message: describeError(err) });
      }
    }, 280);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [query, nearLat, nearLng]);

  // Queries too short to search are always idle, whatever the last response was.
  const search: SearchState = query.trim().length < 2 ? { kind: 'idle' } : searchResult;

  const choose = (place: Place) => {
    onChange(place);
    setQuery('');
    setEditing(false);
    setSearch({ kind: 'idle' });
  };

  const dot = (
    <span
      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
        marker === 'origin' ? 'bg-fg' : marker === 'destination' ? 'bg-accent' : 'border-[1.5px] border-accent'
      }`}
    />
  );

  if (value && !editing) {
    return (
      <div className="group flex h-11 items-center gap-3 rounded-md bg-raised px-3 ring-1 ring-line">
        {dot}
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => {
            setEditing(true);
            setTimeout(() => inputRef.current?.focus());
          }}
          title={value.displayName}
          aria-label={`${label}: ${value.displayName}. Click to change.`}
        >
          <div className="truncate text-[13px] font-medium leading-tight">{value.name}</div>
          <div className="truncate text-[10.5px] leading-tight text-muted">{value.displayName}</div>
        </button>
        <button
          type="button"
          aria-label={`Clear ${label}`}
          className="text-faint opacity-0 transition group-hover:opacity-100 hover:text-fg focus:opacity-100"
          onClick={() => onChange(null)}
        >
          <CloseIcon size={14} />
        </button>
      </div>
    );
  }

  const results = search.kind === 'results' ? search.places : [];
  const open = editing && search.kind !== 'idle';

  return (
    <div className="relative">
      <div className="flex h-11 items-center gap-3 rounded-md bg-ink px-3 ring-1 ring-line focus-within:ring-accent/60">
        {dot}
        <input
          ref={inputRef}
          value={query}
          autoFocus={autoFocus}
          placeholder={label}
          aria-label={label}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
          onFocus={() => setEditing(true)}
          onBlur={() => setTimeout(() => setEditing(false), 150)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && results[active]) {
              e.preventDefault();
              choose(results[active]);
            } else if (e.key === 'Escape') {
              setQuery('');
              setEditing(false);
              inputRef.current?.blur();
            }
          }}
        />
        {search.kind === 'loading' ? (
          <SpinnerIcon size={14} className="text-muted" />
        ) : (
          <SearchIcon size={14} className="text-faint" />
        )}
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-md bg-raised py-1 shadow-2xl ring-1 ring-line-strong"
        >
          {search.kind === 'loading' && <div className="px-3 py-2.5 text-[12px] text-muted">Searching…</div>}
          {search.kind === 'error' && <div className="px-3 py-2.5 text-[12px] text-danger">{search.message}</div>}
          {results.map((place, i) => (
            <button
              key={place.id + i}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(place)}
              className={`block w-full px-3 py-2 text-left ${i === active ? 'bg-white/[0.06]' : ''}`}
            >
              <div className="truncate text-[13px]">{place.name}</div>
              <div className="truncate text-[11px] text-muted">{place.displayName}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

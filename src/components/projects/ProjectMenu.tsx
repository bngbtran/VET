import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createJourney } from '../../models/factory';
import { useAutosave } from '../../hooks/useAutosave';
import { journeyActions, journeyStore, useJourney } from '../../stores/journeyStore';
import {
  deleteProject,
  duplicateJourney,
  fromProjectFile,
  listProjects,
  loadProject,
  rememberLast,
  saveProject,
  toProjectFile,
  type ProjectSummary,
} from '../../stores/projectsDb';
import { slugify } from '../../engine/video/exportVideo';
import { describeError } from '../../utils/errors';
import { ChevronDownIcon } from '../ui/icons';

function relativeTime(ts: number): string {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString();
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProjectMenu() {
  const name = useJourney((s) => s.journey.name);
  const currentId = useJourney((s) => s.journey.id);
  const save = useAutosave();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    listProjects().then(setProjects, (e) => setError(describeError(e)));
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Ctrl/Cmd+S saves immediately (autosave also runs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveProject(journeyStore.get().journey).catch((err) => setError(describeError(err)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const run = (fn: () => Promise<void> | void) => async () => {
    setError(null);
    try {
      await fn();
      setOpen(false);
    } catch (err) {
      setError(describeError(err));
    }
  };

  const actions = {
    create: run(() => {
      const j = createJourney();
      journeyActions.load(j);
      rememberLast(j.id);
    }),
    save: run(() => saveProject(journeyStore.get().journey)),
    duplicate: run(async () => {
      const copy = duplicateJourney(journeyStore.get().journey);
      await saveProject(copy);
      journeyActions.load(copy);
    }),
    remove: run(async () => {
      const j = journeyStore.get().journey;
      if (!window.confirm(`Delete “${j.name}”? This cannot be undone.`)) return;
      await deleteProject(j.id);
      const next = (await listProjects())[0];
      const nextJourney = next ? await loadProject(next.id) : null;
      journeyActions.load(nextJourney ?? createJourney());
    }),
    exportJson: run(() => {
      const j = journeyStore.get().journey;
      download(toProjectFile(j), `vet-${slugify(j.name)}.vet.json`);
    }),
    open: (id: string) =>
      run(async () => {
        const j = await loadProject(id);
        if (!j) throw new Error('That project no longer exists.');
        journeyActions.load(j);
        rememberLast(j.id);
      }),
  };

  const statusText =
    save.state === 'saving' ? 'Saving…' : save.state === 'saved' ? 'Saved locally' : save.state === 'error' ? save.message : '';

  return (
    <div className="flex items-center gap-4">
      <span className={`hidden text-[11px] lg:inline ${save.state === 'error' ? 'text-danger' : 'text-faint'}`}>{statusText}</span>
      <input
        value={name}
        onChange={(e) => journeyActions.setName(e.target.value)}
        aria-label="Journey name"
        className="w-[220px] rounded-md bg-transparent px-2 py-1 text-right text-[12.5px] text-fg/90 outline-none ring-line hover:ring-1 focus:bg-ink focus:ring-1 focus:ring-accent/50"
      />
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] text-muted ring-1 ring-line hover:text-fg"
        >
          Projects <ChevronDownIcon size={13} />
        </button>
        {open && (
          <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-40 w-[290px] rounded-lg bg-raised py-1.5 shadow-2xl ring-1 ring-line-strong">
            <MenuItem onClick={actions.create}>New journey</MenuItem>
            <MenuItem onClick={actions.save}>Save now</MenuItem>
            <MenuItem onClick={actions.duplicate}>Duplicate</MenuItem>
            <MenuItem onClick={actions.remove} danger>
              Delete
            </MenuItem>
            <div className="my-1.5 border-t border-line" />
            <MenuItem onClick={() => fileRef.current?.click()}>Import project…</MenuItem>
            <MenuItem onClick={actions.exportJson}>Export project (JSON)</MenuItem>
            <div className="my-1.5 border-t border-line" />
            <div className="px-3 pb-1 pt-1 font-mono text-[10px] tracking-[0.2em] text-faint">OPEN</div>
            <div className="scroll-quiet max-h-[260px] overflow-y-auto">
              {projects.length === 0 && <div className="px-3 py-2 text-[12px] text-faint">No saved journeys yet.</div>}
              {projects.map((p) => (
                <button
                  key={p.id}
                  role="menuitem"
                  type="button"
                  onClick={actions.open(p.id)}
                  className={`flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-left text-[12.5px] hover:bg-hover ${
                    p.id === currentId ? 'text-accent' : 'text-fg/90'
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-[10.5px] text-faint">{relativeTime(p.updatedAt)}</span>
                </button>
              ))}
            </div>
            {error && <div className="px-3 py-2 text-[11.5px] text-danger">{error}</div>}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            await run(async () => {
              const j = await fromProjectFile(file);
              await saveProject(j);
              journeyActions.load(j);
            })();
          }}
        />
      </div>
      {error && !open && (
        <span className="max-w-[260px] truncate text-[11px] text-danger" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}

function MenuItem({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`block w-full px-3 py-1.5 text-left text-[12.5px] hover:bg-hover ${danger ? 'text-danger' : 'text-fg/90'}`}
    >
      {children}
    </button>
  );
}

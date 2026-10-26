import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-5">
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="font-mono text-[10.5px] font-medium tracking-[0.22em] text-muted">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-[11.5px] text-muted">{children}</div>;
}

interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  title?: string;
}

/** A row of mutually exclusive options. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-0.5 rounded-md bg-ink p-0.5 ring-1 ring-line">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[5px] font-medium transition-colors ${
              size === 'sm' ? 'h-7 text-[11.5px]' : 'h-8 text-[12.5px]'
            } ${active ? 'bg-raised text-fg ring-1 ring-line-strong' : 'text-muted hover:text-fg'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1 text-[12.5px] text-fg/85">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-[18px] w-[30px] rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-white/12'}`}
      >
        <span
          className={`absolute top-[3px] h-3 w-3 rounded-full bg-ink transition-[left] ${checked ? 'left-[15px]' : 'left-[3px]'}`}
        />
      </button>
    </label>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'quiet' };

export function Button({ variant = 'ghost', className = '', ...rest }: ButtonProps) {
  const styles = {
    primary:
      'bg-accent text-ink hover:brightness-110 disabled:bg-white/10 disabled:text-faint font-semibold tracking-[0.12em]',
    ghost: 'bg-raised text-fg ring-1 ring-line hover:ring-line-strong disabled:text-faint',
    quiet: 'text-muted hover:text-fg disabled:text-faint',
  }[variant];
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-md text-[12.5px] transition disabled:cursor-not-allowed ${styles} ${className}`}
      {...rest}
    />
  );
}

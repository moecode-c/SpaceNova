import { cn } from '../../lib/cn.js';
import { TONES } from './primitives.jsx';
import { clamp } from '../../lib/random.js';

export function Panel({ className, children, flush, ...props }) {
  return (
    <section className={cn('panel', flush ? '' : 'overflow-hidden', className)} {...props}>
      {children}
    </section>
  );
}

export function PanelHeader({ title, subtitle, icon: Icon, actions, className, children }) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} className="shrink-0 text-ink-faint" aria-hidden />}
          <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
        </div>
        {subtitle && (
          <p className="mt-1 break-words text-xs leading-relaxed text-ink-faint">{subtitle}</p>
        )}
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PanelBody({ className, children, padded = true }) {
  return <div className={cn(padded && 'p-4', className)}>{children}</div>;
}

export function PanelFooter({ className, children }) {
  return (
    <footer className={cn('flex items-center gap-3 border-t border-line bg-base/40 px-4 py-2.5', className)}>
      {children}
    </footer>
  );
}

/** A labelled block of page content with an optional description. */
export function Section({ title, description, actions, className, children, id }) {
  return (
    <section id={id} className={cn('space-y-3', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {description && (
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-faint">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * A single number with its label. `hint` carries the source or the threshold
 * that produced it, which is how the data-provenance requirement reaches the
 * smaller readouts.
 */
export function StatTile({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone = 'default',
  delta,
  deltaTone,
  className,
  children,
}) {
  const t = TONES[tone] ?? TONES.default;
  return (
    <div className={cn('panel flex flex-col gap-1 p-3.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="label-caps truncate">{label}</span>
        {Icon && <Icon size={14} className={cn('shrink-0', tone === 'default' ? 'text-ink-faint' : t.text)} aria-hidden />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('tnum font-mono text-xl font-semibold leading-none', tone === 'default' ? 'text-ink' : t.text)}>
          {value}
        </span>
        {unit && <span className="text-xs text-ink-faint">{unit}</span>}
        {delta !== undefined && delta !== null && (
          <span
            className={cn(
              'tnum ml-1 font-mono text-2xs',
              (deltaTone ?? (Number(delta) >= 0 ? 'good' : 'bad')) === 'good' ? 'text-good' : 'text-bad',
            )}
          >
            {Number(delta) >= 0 ? '+' : ''}
            {delta}
          </span>
        )}
      </div>
      {hint && <p className="mt-0.5 text-2xs leading-relaxed text-ink-faint">{hint}</p>}
      {children}
    </div>
  );
}

/** Definition rows. Used on every detail screen for the specification tables. */
export function KeyValue({ rows, columns = 1, className, dense }) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-6',
        columns === 2 ? 'sm:grid-cols-2' : columns === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : '',
        dense ? 'gap-y-1.5' : 'gap-y-2.5',
        className,
      )}
    >
      {rows
        .filter((row) => row && row.value !== undefined)
        .map((row) => (
          <div
            key={row.label}
            className={cn(
              'flex items-baseline justify-between gap-4 border-b border-line/60 pb-1.5 last:border-0',
              row.wide && 'sm:col-span-2 lg:col-span-3',
            )}
          >
            <dt className="shrink-0 text-xs text-ink-faint">{row.label}</dt>
            <dd
              className={cn(
                'min-w-0 break-words text-right text-xs text-ink',
                row.mono !== false && 'tnum font-mono',
                row.className,
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
    </dl>
  );
}

/** Horizontal bar for a 0..1 quantity. */
export function Meter({ value, tone = 'primary', label, right, className, height = 'h-1.5' }) {
  const pct = clamp(Number(value) || 0, 0, 1) * 100;
  const t = TONES[tone] ?? TONES.primary;
  return (
    <div className={cn('space-y-1', className)}>
      {(label || right) && (
        <div className="flex items-baseline justify-between gap-2 text-2xs">
          {label && <span className="text-ink-faint">{label}</span>}
          {right && <span className="tnum font-mono text-ink-dim">{right}</span>}
        </div>
      )}
      <div className={cn('w-full overflow-hidden rounded-full bg-overlay', height)}>
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', t.dot)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Stacked segments, for a role or outcome breakdown. */
export function SegmentBar({ segments, className }) {
  const total = segments.reduce((n, s) => n + s.value, 0) || 1;
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-overlay">
        {segments.map((s) => (
          <div
            key={s.label}
            className={cn('h-full', (TONES[s.tone] ?? TONES.primary).dot)}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-2xs text-ink-faint">
            <span className={cn('h-1.5 w-1.5 rounded-full', (TONES[s.tone] ?? TONES.primary).dot)} aria-hidden />
            {s.label}
            <span className="tnum font-mono text-ink-dim">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Page title block with breadcrumb slot and actions. */
export function PageHeader({ title, description, actions, meta, breadcrumb, icon: Icon, className }) {
  return (
    <header className={cn('space-y-3', className)}>
      {breadcrumb}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-primary">
                <Icon size={16} aria-hidden />
              </span>
            )}
            <h1 className="truncate text-xl font-semibold tracking-[-0.015em] text-ink">{title}</h1>
          </div>
          {description && (
            <p className="max-w-3xl text-sm leading-relaxed text-ink-dim">{description}</p>
          )}
          {meta && <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Scrollable grid of panels with a consistent gap. */
export function Grid({ cols = 3, className, children }) {
  const map = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
    5: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
  };
  return <div className={cn('grid grid-cols-1 gap-3', map[cols] ?? map[3], className)}>{children}</div>;
}

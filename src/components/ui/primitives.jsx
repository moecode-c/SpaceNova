import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * Semantic tone classes shared by badges, banners and status dots. Keeping them
 * in one map is what stops "warning amber" drifting between screens.
 *
 * Only the status tones carry a hue. "primary" and "default" are white and
 * grey: the design system has no accent colour.
 */
export const TONES = {
  default: { text: 'text-ink-dim', bg: 'bg-transparent', border: 'border-line-strong', dot: 'bg-ink-faint' },
  primary: { text: 'text-ink', bg: 'bg-primary-soft', border: 'border-primary-dim', dot: 'bg-primary' },
  good: { text: 'text-good', bg: 'bg-good-soft', border: 'border-good/40', dot: 'bg-good' },
  warn: { text: 'text-warn', bg: 'bg-warn-soft', border: 'border-warn/40', dot: 'bg-warn' },
  bad: { text: 'text-bad', bg: 'bg-bad-soft', border: 'border-bad/40', dot: 'bg-bad' },
  info: { text: 'text-info', bg: 'bg-info-soft', border: 'border-info/40', dot: 'bg-info' },
};

/*
 * Buttons are pills with all-caps labels. The ghost pill (`outline`) is the
 * design system's signature control and the only call to action on marketing
 * surfaces; `primary` is the one solid control, kept for the commit action on
 * a form or a panel.
 */
const BUTTON_VARIANTS = {
  primary: 'border border-cool bg-cool text-black hover:border-ink hover:bg-ink',
  secondary: 'border border-line-strong text-ink hover:border-ink',
  ghost: 'text-ink-dim hover:bg-overlay hover:text-ink',
  outline: 'border border-ink text-ink hover:bg-cool hover:text-black',
  danger: 'border border-bad/70 text-bad hover:border-bad hover:bg-bad hover:text-black',
  subtle: 'border border-line-strong bg-overlay text-ink hover:border-ink',
};

const BUTTON_SIZES = {
  xs: 'h-7 px-3 text-2xs gap-1.5',
  sm: 'h-8 px-4 text-2xs gap-1.5',
  md: 'h-10 px-5 text-xs gap-2',
  // The marketing CTA: 18px / 24px padding around 13px caps.
  lg: 'h-[3.125rem] px-6 text-[0.8125rem] gap-2.5',
};

export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, loading, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? 'button'}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-bold uppercase tracking-cap transition-colors',
        'disabled:pointer-events-none disabled:opacity-45',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'xs' ? 12 : 14} className="animate-spin" aria-hidden />
      ) : (
        Icon && <Icon size={size === 'xs' ? 12 : size === 'lg' ? 16 : 14} aria-hidden />
      )}
      {children}
      {IconRight && <IconRight size={size === 'xs' ? 12 : 14} aria-hidden />}
    </button>
  );
});

export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, size = 'md', variant = 'ghost', className, ...props },
  ref,
) {
  const box = { xs: 'h-6 w-6', sm: 'h-7 w-7', md: 'h-8 w-8', lg: 'h-10 w-10' }[size];
  const glyph = { xs: 12, sm: 14, md: 15, lg: 18 }[size];
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        BUTTON_VARIANTS[variant],
        box,
        className,
      )}
      {...props}
    >
      <Icon size={glyph} aria-hidden />
    </button>
  );
});

/**
 * Status badge. Always carries a word, never colour alone: section 6.4 of the
 * SRS requires status to be legible without relying on hue.
 */
export function Badge({ tone = 'default', icon: Icon, dot, size = 'md', className, children }) {
  const t = TONES[tone] ?? TONES.default;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-micro',
        size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs',
        t.bg,
        t.border,
        t.text,
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', t.dot)} aria-hidden />}
      {Icon && <Icon size={size === 'sm' ? 11 : 12} aria-hidden />}
      {children}
    </span>
  );
}

/** A square-ish tag for short codes: orbit class, band, format. */
export function Tag({ className, children, mono = true }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border border-line-strong px-1.5 py-0.5 text-2xs text-ink-dim',
        mono && 'font-mono',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone = 'default', pulse, label }) {
  const t = TONES[tone] ?? TONES.default;
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0" title={label}>
      {pulse && (
        <span className={cn('absolute inset-0 rounded-full opacity-60', t.dot, 'animate-pulse-ring')} aria-hidden />
      )}
      <span className={cn('relative h-2 w-2 rounded-full', t.dot)} aria-hidden />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

export function Avatar({ name, size = 'md', className }) {
  const box = { sm: 'h-6 w-6 text-2xs', md: 'h-8 w-8 text-xs', lg: 'h-11 w-11 text-sm' }[size];
  const letters = (name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-line-strong bg-overlay font-bold text-ink-dim',
        box,
        className,
      )}
      aria-hidden
    >
      {letters}
    </span>
  );
}

export function Spinner({ size = 16, className }) {
  return <Loader2 size={size} className={cn('animate-spin text-ink-faint', className)} aria-hidden />;
}

/** A flat pulse rather than a sweeping gradient: the system has no gradients. */
export function Skeleton({ className }) {
  return <span className={cn('block animate-pulse rounded bg-overlay', className)} aria-hidden />;
}

export function Divider({ className, vertical }) {
  return vertical ? (
    <span className={cn('inline-block w-px self-stretch bg-line', className)} aria-hidden />
  ) : (
    <hr className={cn('border-t border-line', className)} />
  );
}

export function Kbd({ children }) {
  return (
    <kbd className="rounded border border-line-strong bg-overlay px-1.5 py-0.5 text-2xs text-ink-dim">
      {children}
    </kbd>
  );
}

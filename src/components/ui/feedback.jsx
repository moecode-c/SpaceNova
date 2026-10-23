import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, CircleAlert, Info, Inbox, RefreshCw, X,
} from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { Button, Spinner, TONES } from './primitives.jsx';

export function EmptyState({ icon: Icon = Inbox, title, description, action, className, compact }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-overlay/60 text-ink-faint">
        <Icon size={18} aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-ink-faint">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, className, compact }) {
  const message =
    typeof error === 'string' ? error : error?.message ?? 'Something went wrong loading this view.';
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        compact ? 'px-4 py-8' : 'px-6 py-12',
        className,
      )}
      role="alert"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-bad/40 bg-bad-soft/60 text-bad">
        <CircleAlert size={18} aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">Could not load this</p>
        <p className="mx-auto max-w-md text-xs leading-relaxed text-ink-faint">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ label = 'Loading', className, compact }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2.5',
        compact ? 'py-8' : 'py-14',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner size={18} />
      <p className="text-xs text-ink-faint">{label}</p>
    </div>
  );
}

const BANNER_ICONS = { info: Info, good: CheckCircle2, warn: AlertTriangle, bad: CircleAlert, primary: Info, default: Info };

/**
 * Inline banner. The degraded-mode and staleness notices in SRS Appendix G.2
 * are rendered with this, which is why it takes a title plus a body rather than
 * a single string: the user has to be told which source and how old.
 */
export function Banner({ tone = 'info', title, children, icon, action, onDismiss, className, compact }) {
  const t = TONES[tone] ?? TONES.info;
  const Icon = icon ?? BANNER_ICONS[tone] ?? Info;
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-card border',
        compact ? 'px-3 py-2' : 'px-3.5 py-3',
        t.bg,
        t.border,
        className,
      )}
      role={tone === 'bad' ? 'alert' : 'status'}
    >
      <Icon size={15} className={cn('mt-px shrink-0', t.text)} aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="text-xs font-semibold text-ink">{title}</p>}
        {children && <div className="text-xs leading-relaxed text-ink-dim">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded p-0.5 text-ink-faint transition-colors hover:text-ink"
        >
          <X size={13} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** A short parenthetical note under a readout. */
export function InlineNote({ children, className, icon: Icon = Info }) {
  return (
    <p className={cn('flex items-start gap-1.5 text-2xs leading-relaxed text-ink-faint', className)}>
      <Icon size={11} className="mt-0.5 shrink-0" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/* ---------------------------------------------------------------- toasts --- */

const ToastContext = createContext({ push: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((list) => [...list.slice(-3), { id, tone: 'default', ...toast }]);
    return id;
  }, []);

  const value = useMemo(
    () => ({
      push,
      remove,
      success: (title, body) => push({ tone: 'good', title, body }),
      error: (title, body) => push({ tone: 'bad', title, body, duration: 7000 }),
      info: (title, body) => push({ tone: 'primary', title, body }),
      warn: (title, body) => push({ tone: 'warn', title, body }),
    }),
    [push, remove],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => remove(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

function Toast({ toast, onDismiss }) {
  const t = TONES[toast.tone] ?? TONES.default;
  const Icon = BANNER_ICONS[toast.tone] ?? Info;

  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.duration ?? 4500);
    return () => clearTimeout(timer);
  }, [onDismiss, toast.duration]);

  return (
    <div
      className={cn(
        'pointer-events-auto flex animate-fade-in items-start gap-2.5 rounded-card border bg-raised/95 px-3.5 py-3 shadow-pop backdrop-blur',
        t.border,
      )}
      role="status"
    >
      <Icon size={15} className={cn('mt-px shrink-0', t.text)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink">{toast.title}</p>
        {toast.body && <p className="mt-0.5 text-2xs leading-relaxed text-ink-dim">{toast.body}</p>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-0.5 text-ink-faint transition-colors hover:text-ink"
      >
        <X size={13} aria-hidden />
      </button>
    </div>
  );
}

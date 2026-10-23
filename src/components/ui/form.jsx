import { forwardRef, useId } from 'react';
import { AlertCircle, Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/*
 * Inputs follow the design system: a 4px radius, a 1px hairline, black ground,
 * and the 44px minimum field height. A caller that passes its own `h-*` (the
 * dense inline selects in tables and toolbars) gets that height instead, since
 * class names are joined rather than merged and two heights would otherwise
 * fight on stylesheet order.
 */
const CONTROL =
  'w-full rounded-card border border-line-strong bg-base px-4 text-sm text-ink placeholder:text-ink-faint/80 ' +
  'transition-colors hover:border-ink-faint focus:border-ink disabled:opacity-50';

const controlHeight = (className) => (/(^|\s)h-/.test(className ?? '') ? '' : 'h-11');

/**
 * Field wrapper. Every control gets a real label and, when something is wrong,
 * an error message with an icon rather than a red border on its own, which is
 * the "never by colour alone" rule from SRS section 6.3.
 */
export function Field({ label, htmlFor, hint, error, required, className, children, inline }) {
  return (
    <div className={cn(inline ? 'flex items-center justify-between gap-4' : 'space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className={cn(
            'block text-2xs font-semibold uppercase tracking-micro text-ink-dim',
            inline && 'shrink-0',
          )}
        >
          {label}
          {required && <span className="ml-1 text-bad">*</span>}
        </label>
      )}
      <div className={cn(inline ? 'min-w-0 flex-1' : 'space-y-1.5')}>
        {children}
        {hint && !error && <p className="text-2xs leading-relaxed text-ink-faint">{hint}</p>}
        {error && (
          <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-bad">
            <AlertCircle size={12} className="mt-px shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export const Input = forwardRef(function Input({ className, invalid, suffix, ...props }, ref) {
  return (
    <div className="relative">
      <input
        ref={ref}
        className={cn(
          CONTROL,
          controlHeight(className),
          invalid && 'border-bad/70',
          suffix && 'pr-12',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...props}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-2xs text-ink-faint">
          {suffix}
        </span>
      )}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ className, invalid, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(CONTROL, 'resize-y py-3 leading-relaxed', invalid && 'border-bad/70', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          CONTROL,
          controlHeight(className),
          'cursor-pointer appearance-none pr-10',
          invalid && 'border-bad/70',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
        aria-hidden
      />
    </div>
  );
});

export function Checkbox({ label, description, checked, onChange, disabled, className, id: providedId }) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <button
        type="button"
        role="checkbox"
        id={id}
        aria-checked={!!checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors',
          checked ? 'border-ink bg-ink text-black' : 'border-line-strong bg-base hover:border-ink',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {checked && <Check size={11} strokeWidth={3} aria-hidden />}
      </button>
      {(label || description) && (
        <label htmlFor={id} className="min-w-0 cursor-pointer select-none">
          {label && <span className="block text-xs text-ink">{label}</span>}
          {description && (
            <span className="mt-0.5 block text-2xs leading-relaxed text-ink-faint">{description}</span>
          )}
        </label>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, disabled, className, id: providedId }) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      {(label || description) && (
        <label htmlFor={id} className="min-w-0 cursor-pointer select-none">
          {label && <span className="block text-xs font-semibold text-ink">{label}</span>}
          {description && (
            <span className="mt-0.5 block text-2xs leading-relaxed text-ink-faint">{description}</span>
          )}
        </label>
      )}
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={!!checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
          checked ? 'border-ink bg-ink' : 'border-line-strong bg-transparent',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <span
          className={cn(
            'absolute h-3.5 w-3.5 rounded-full transition-transform',
            checked ? 'translate-x-[1.1rem] bg-black' : 'translate-x-[0.15rem] bg-ink-faint',
          )}
          aria-hidden
        />
      </button>
    </div>
  );
}

export function RadioGroup({ options, value, onChange, name, className, columns = 1 }) {
  return (
    <div className={cn('grid grid-cols-1 gap-2', columns === 2 && 'sm:grid-cols-2', className)} role="radiogroup">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            name={name}
            aria-checked={active}
            onClick={() => onChange?.(option.value)}
            className={cn(
              'flex items-start gap-2.5 rounded-card border p-3 text-left transition-colors',
              active ? 'border-ink bg-primary-soft' : 'border-line-strong hover:border-ink-faint',
            )}
          >
            <span
              className={cn(
                'mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
                active ? 'border-ink' : 'border-line-strong',
              )}
              aria-hidden
            >
              {active && <span className="h-1.5 w-1.5 rounded-full bg-ink" />}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-ink">{option.label}</span>
              {option.description && (
                <span className="mt-0.5 block text-2xs leading-relaxed text-ink-faint">
                  {option.description}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search', className, autoFocus, onSubmit }) {
  return (
    <form
      className={cn('relative', className)}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(value);
      }}
      role="search"
    >
      <Search
        size={14}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(CONTROL, 'h-11 pl-10', value && 'pr-10')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange?.('')}
          aria-label="Clear search"
          className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-faint hover:text-ink"
        >
          <X size={13} aria-hidden />
        </button>
      )}
    </form>
  );
}

export function Slider({ value, min, max, step = 1, onChange, label, display, className }) {
  const id = useId();
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-2xs font-semibold uppercase tracking-micro text-ink-dim">
          {label}
        </label>
        <span className="tnum font-mono text-xs text-ink">{display ?? value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange?.(Number(e.target.value))}
      />
    </div>
  );
}

/** Groups related fields with a caption, used on the settings screens. */
export function Fieldset({ legend, description, className, children, columns = 1 }) {
  return (
    <fieldset className={cn('space-y-3', className)}>
      {legend && (
        <div>
          <legend className="text-xs font-semibold uppercase tracking-micro text-ink-faint">
            {legend}
          </legend>
          {description && (
            <p className="mt-1.5 max-w-2xl text-2xs leading-relaxed text-ink-faint">{description}</p>
          )}
        </div>
      )}
      <div className={cn('grid grid-cols-1 gap-3', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')}>
        {children}
      </div>
    </fieldset>
  );
}

/** Top-of-form summary of a failed submission. */
export function FormError({ error, className }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-card border border-bad/40 bg-bad-soft px-3.5 py-3',
        className,
      )}
    >
      <AlertCircle size={14} className="mt-px shrink-0 text-bad" aria-hidden />
      <div className="min-w-0 text-xs leading-relaxed text-ink">
        {typeof error === 'string' ? error : error.message}
      </div>
    </div>
  );
}

import { forwardRef, useId } from 'react';
import { AlertCircle, Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '../../lib/cn.js';

const CONTROL =
  'w-full rounded-md border border-line-strong bg-base/80 px-3 text-sm text-ink placeholder:text-ink-faint/80 ' +
  'transition-colors hover:border-line-strong focus:border-primary-dim focus:bg-base disabled:opacity-50';

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
          className={cn('block text-xs font-medium text-ink-dim', inline && 'shrink-0')}
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
        className={cn(CONTROL, 'h-9', invalid && 'border-bad/60', suffix && 'pr-12', className)}
        aria-invalid={invalid || undefined}
        {...props}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-2xs text-ink-faint">
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
      className={cn(CONTROL, 'resize-y py-2 leading-relaxed', invalid && 'border-bad/60', className)}
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
          'h-9 cursor-pointer appearance-none pr-9',
          invalid && 'border-bad/60',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint"
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
          'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          checked
            ? 'border-primary bg-primary text-[#04121f]'
            : 'border-line-strong bg-base hover:border-primary-dim',
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
          {label && <span className="block text-xs font-medium text-ink">{label}</span>}
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
          checked ? 'border-primary-dim bg-primary/80' : 'border-line-strong bg-overlay',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <span
          className={cn(
            'absolute h-3.5 w-3.5 rounded-full bg-ink transition-transform',
            checked ? 'translate-x-[1.1rem]' : 'translate-x-[0.15rem]',
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
              'flex items-start gap-2.5 rounded-md border p-2.5 text-left transition-colors',
              active
                ? 'border-primary-dim bg-primary-soft/40'
                : 'border-line bg-base/50 hover:border-line-strong',
            )}
          >
            <span
              className={cn(
                'mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
                active ? 'border-primary' : 'border-line-strong',
              )}
              aria-hidden
            >
              {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-ink">{option.label}</span>
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
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(CONTROL, 'h-9 pl-9', value && 'pr-9')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange?.('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-faint hover:text-ink"
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
        <label htmlFor={id} className="text-xs font-medium text-ink-dim">
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
          <legend className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-faint">
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
        'flex items-start gap-2.5 rounded-md border border-bad/40 bg-bad-soft/60 px-3 py-2.5',
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

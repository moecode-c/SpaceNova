import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/** Underlined tab strip. Used inside detail pages. */
export function Tabs({ tabs, value, onChange, className, size = 'md' }) {
  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto border-b border-line', className)} role="tablist">
      {tabs.map((tab) => {
        const active = value === tab.value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative inline-flex items-center gap-2 whitespace-nowrap border-b-2 font-bold uppercase tracking-micro transition-colors',
              size === 'sm' ? 'px-3 py-2 text-2xs' : 'px-3.5 py-3 text-xs',
              active
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-faint hover:text-ink',
            )}
          >
            {Icon && <Icon size={14} aria-hidden />}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'tnum rounded-full px-1.5 py-0.5 font-mono text-2xs font-semibold tracking-normal',
                  active ? 'bg-ink text-black' : 'bg-overlay text-ink-faint',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Compact mutually exclusive switch, for view modes and ranges. */
export function SegmentedControl({ options, value, onChange, className, size = 'md', ariaLabel }) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-full border border-line-strong p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const active = value === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title ?? option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-micro transition-colors',
              size === 'sm' ? 'px-3 py-1 text-2xs' : 'px-3.5 py-1.5 text-2xs',
              active ? 'bg-cool text-black' : 'text-ink-faint hover:text-ink',
            )}
          >
            {Icon && <Icon size={size === 'sm' ? 12 : 13} aria-hidden />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Breadcrumbs({ items, className }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex flex-wrap items-center gap-1 text-2xs uppercase tracking-micro text-ink-faint', className)}
    >
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight size={11} className="text-ink-faint/60" aria-hidden />}
          {item.to ? (
            <Link to={item.to} className="transition-colors hover:text-ink">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink-dim">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Left-hand list navigation inside a settings or workspace area. */
export function SideList({ items, value, onChange, className }) {
  return (
    <nav className={cn('space-y-0.5', className)}>
      {items.map((item) => {
        const active = value === item.value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-card px-3 py-2.5 text-left text-2xs font-bold uppercase tracking-micro transition-colors',
              active
                ? 'bg-overlay text-ink'
                : 'text-ink-faint hover:bg-overlay hover:text-ink',
            )}
          >
            {Icon && <Icon size={14} className="shrink-0" aria-hidden />}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.count !== undefined && (
              <span className="tnum shrink-0 font-mono text-2xs opacity-70">{item.count}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

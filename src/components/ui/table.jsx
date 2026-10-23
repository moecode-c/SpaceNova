import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { Button, Skeleton } from './primitives.jsx';
import { EmptyState } from './feedback.jsx';

/**
 * Data table.
 *
 * Columns are declared as objects so every table on the site gets the same
 * alignment, sorting affordance and keyboard behaviour:
 *   { key, header, width, align, mono, sortable, render(row), hideBelow }
 */
export function DataTable({
  columns,
  rows,
  rowKey = (row) => row.id,
  sort,
  direction = 'asc',
  onSort,
  onRowClick,
  loading,
  loadingRows = 8,
  empty,
  className,
  dense,
  stickyHeader = true,
}) {
  const cellPadding = dense ? 'px-3 py-1.5' : 'px-3 py-2.5';

  if (!loading && rows.length === 0) {
    return empty ?? <EmptyState title="Nothing to show" description="No rows match the current filters." />;
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-full border-collapse text-left">
        <thead className={cn(stickyHeader && 'sticky top-0 z-10')}>
          <tr className="border-b border-line bg-surface">
            {columns.map((col) => {
              const active = sort === col.key;
              const Icon = !active ? ChevronsUpDown : direction === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'label-caps whitespace-nowrap bg-surface font-semibold',
                    cellPadding,
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.hideBelow === 'md' && 'hidden md:table-cell',
                    col.hideBelow === 'lg' && 'hidden lg:table-cell',
                    col.hideBelow === 'xl' && 'hidden xl:table-cell',
                  )}
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={cn(
                        'inline-flex items-center gap-1.5 transition-colors hover:text-ink',
                        active && 'text-primary-bright',
                        col.align === 'right' && 'flex-row-reverse',
                      )}
                    >
                      {col.header}
                      <Icon size={11} aria-hidden />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: loadingRows }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-b border-line/60">
                  {columns.map((col) => (
                    <td key={col.key} className={cellPadding}>
                      <Skeleton className="h-3.5 w-full max-w-[12rem]" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-line/60 transition-colors last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-overlay/50',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'align-middle text-xs text-ink-dim',
                        cellPadding,
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.mono && 'tnum font-mono',
                        col.nowrap !== false && 'whitespace-nowrap',
                        col.hideBelow === 'md' && 'hidden md:table-cell',
                        col.hideBelow === 'lg' && 'hidden lg:table-cell',
                        col.hideBelow === 'xl' && 'hidden xl:table-cell',
                      )}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pages, total, from, to, onPage, unit = 'rows', className }) {
  if (!pages || pages <= 1) {
    return total ? (
      <div className={cn('flex items-center justify-end px-4 py-2.5 text-2xs text-ink-faint', className)}>
        {total} {unit}
      </div>
    ) : null;
  }
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5',
        className,
      )}
    >
      <span className="tnum text-2xs text-ink-faint">
        {from}&ndash;{to} of {total} {unit}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          size="xs"
          variant="ghost"
          icon={ChevronLeft}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <span className="tnum px-2 font-mono text-2xs text-ink-dim">
          {page} / {pages}
        </span>
        <Button
          size="xs"
          variant="ghost"
          iconRight={ChevronRight}
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/** Filter bar above a table. */
export function Toolbar({ className, children, right }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

/** Multi-select chips, used for the catalogue facets. */
export function FilterChips({ options, selected = [], onToggle, label, className }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {label && <span className="label-caps mr-0.5">{label}</span>}
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs transition-colors',
              active
                ? 'border-primary-dim bg-primary-soft/60 text-primary-bright'
                : 'border-line bg-base/60 text-ink-faint hover:border-line-strong hover:text-ink-dim',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="tnum font-mono opacity-70">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

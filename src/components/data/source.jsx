import { Cpu, Database, CloudOff, Clock, FlaskConical, Radio } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { age, utcStamp } from '../../lib/format.js';
import { Tooltip } from '../ui/overlay.jsx';
import { Banner } from '../ui/feedback.jsx';

/**
 * Source tag.
 *
 * SRS module 9 and section 6.9 require every value on screen to carry its
 * source and its age, and require that a computed value is never presented as a
 * measurement. This component is how that promise is kept: it reads the `meta`
 * envelope returned by every api/* call and prints the source, the age, and
 * whether the figure was computed, fetched or served from cache.
 */

const KIND_ICON = {
  computed: Cpu,
  fixture: FlaskConical,
  feed: Radio,
  session: Database,
};

const KIND_LABEL = {
  computed: 'Computed',
  fixture: 'Fixture',
  feed: 'Feed',
  session: 'Session',
};

export function SourceTag({ meta, className, showStamp = false, compact = false }) {
  if (!meta) return null;

  const kind = meta.kind === 'computed' ? 'computed' : meta.source?.startsWith('fixture') ? 'fixture' : meta.kind ?? 'fixture';
  const Icon = meta.degraded ? CloudOff : KIND_ICON[kind] ?? Database;
  const retrieved = meta.retrievedAt;

  const tooltip = [
    `Source: ${meta.sourceLabel ?? meta.source}`,
    retrieved ? `Retrieved: ${utcStamp(retrieved)}` : null,
    meta.cached ? `Served from cache (${meta.cacheAgeMinutes ?? '?'} min old)` : null,
    meta.degradedReason ?? null,
    kind === 'computed'
      ? 'Derived by the propagation engine. Not a measurement.'
      : kind === 'fixture'
        ? 'Phase 1 fixture data. Replaced by a live provider in Phase 2.'
        : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <Tooltip label={tooltip} side="top">
      <span
        className={cn(
          'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs',
          meta.degraded
            ? 'border-warn/30 bg-warn-soft/50 text-warn'
            : 'border-line bg-base/60 text-ink-faint',
          className,
        )}
      >
        <Icon size={10} className="shrink-0" aria-hidden />
        {!compact && <span className="font-medium">{KIND_LABEL[kind] ?? 'Source'}</span>}
        {!compact && <span className="opacity-40">&middot;</span>}
        <span className="truncate">{meta.sourceLabel ?? meta.source}</span>
        {retrieved && (
          <>
            <span className="opacity-40">&middot;</span>
            <span className="tnum whitespace-nowrap font-mono">{age(retrieved)}</span>
          </>
        )}
        {showStamp && retrieved && (
          <span className="tnum hidden font-mono opacity-70 lg:inline">{utcStamp(retrieved)}</span>
        )}
      </span>
    </Tooltip>
  );
}

/** Just the age, for table cells and small readouts. */
export function AgeTag({ at, label = 'Updated', className }) {
  if (!at) return null;
  return (
    <Tooltip label={`${label}: ${utcStamp(at)}`}>
      <span className={cn('inline-flex items-center gap-1 text-2xs text-ink-faint', className)}>
        <Clock size={10} aria-hidden />
        <span className="tnum font-mono">{age(at)}</span>
      </span>
    </Tooltip>
  );
}

/**
 * The staleness banner required by SRS Appendix G.2 when cached data is served
 * past its time to live, and the degraded-mode notice when a term has been
 * dropped from a computation.
 */
export function DegradedBanner({ meta, className, compact = true }) {
  if (!meta?.degraded && !meta?.cached) return null;

  if (meta.degraded) {
    return (
      <Banner tone="warn" title="Degraded data" compact={compact} className={className}>
        {meta.degradedReason ?? 'A provider is unavailable and cached data is being served.'}
        {meta.sourceLabel && (
          <>
            {' '}
            Source: <span className="text-ink">{meta.sourceLabel}</span>
            {meta.retrievedAt && <> , {age(meta.retrievedAt)}.</>}
          </>
        )}
      </Banner>
    );
  }

  return (
    <Banner tone="warn" title="Serving cached data" compact={compact} className={className}>
      {meta.sourceLabel} was last reached {age(meta.retrievedAt)}
      {meta.cacheAgeMinutes !== null && meta.cacheAgeMinutes !== undefined && (
        <> and the cache entry is {meta.cacheAgeMinutes} minutes old</>
      )}
      .
    </Banner>
  );
}

/**
 * The fixture notice. Shown once per screen that reads catalogue or provider
 * fixtures, so nobody mistakes Phase 1 data for the real thing.
 */
export function FixtureNotice({ children, className, compact = true }) {
  return (
    <Banner tone="info" title="Phase 1 fixture data" compact={compact} className={className} icon={FlaskConical}>
      {children ??
        'Names and catalogue numbers are real for recognisability, but all orbital elements and provider figures on this page are generated locally. Phase 2 reads them from Celestrak, Space-Track and the public feeds listed in the specification.'}
    </Banner>
  );
}

/** Marks a panel whose numbers come out of the engine rather than a provider. */
export function ComputedNotice({ children, className }) {
  return (
    <Banner tone="info" title="Computed values" compact className={className} icon={Cpu}>
      {children ??
        'Every figure in this panel is derived from the element set by the propagation engine. None of them is a measurement.'}
    </Banner>
  );
}

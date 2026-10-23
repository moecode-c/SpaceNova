/**
 * The seam between the interface and the back end.
 *
 * Every screen reaches its data through src/api/*. In Phase 1 those modules
 * read the in-memory fixtures in src/mock/*; in Phase 2 each one is replaced by
 * a call to the Express API without any screen changing, because the function
 * signatures and the response envelope stay the same.
 *
 * The envelope is deliberate. SRS module 9 and section 6.9 require every value
 * on screen to carry its source and its age, and the degraded-mode rules in
 * Appendix G.2 require a visible staleness banner when cached data is served
 * past its time to live. Returning { data, meta } from every call is what makes
 * that possible without each page inventing its own convention.
 */

export class ApiError extends Error {
  constructor(message, { status = 400, code = 'bad_request', fields = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** Simulated network latency, so loading states are real rather than theoretical. */
const LATENCY = { min: 90, max: 320 };

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function latency(scale = 1) {
  const ms = (LATENCY.min + Math.random() * (LATENCY.max - LATENCY.min)) * scale;
  await sleep(ms);
}

/**
 * Build the response envelope.
 *
 * @template T
 * @param {T} data
 * @param {object} [meta]
 * @returns {{ data: T, meta: object }}
 */
export function envelope(data, meta = {}) {
  const retrievedAt = meta.retrievedAt ?? new Date().toISOString();
  return {
    data,
    meta: {
      source: meta.source ?? 'fixture',
      sourceLabel: meta.sourceLabel ?? 'Bundled fixture',
      // 'computed' marks a value the engine derived rather than one that was
      // fetched. The interface must never present a computed value as measured.
      kind: meta.kind ?? 'fixture',
      retrievedAt,
      cached: meta.cached ?? false,
      cacheAgeMinutes: meta.cacheAgeMinutes ?? null,
      degraded: meta.degraded ?? false,
      degradedReason: meta.degradedReason ?? null,
      thresholds: meta.thresholds ?? null,
      ...meta,
    },
  };
}

/**
 * Run a fixture-backed handler with simulated latency and uniform errors.
 *
 * @template T
 * @param {() => T | Promise<T>} handler
 * @param {{ scale?: number }} [options]
 * @returns {Promise<T>}
 */
export async function call(handler, { scale = 1 } = {}) {
  await latency(scale);
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error?.message ?? 'Unexpected error', {
      status: 500,
      code: 'internal',
    });
  }
}

/** Sort, filter and page a fixture array the way a server endpoint would. */
export function paginate(rows, { page = 1, pageSize = 25 } = {}) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    page: current,
    pageSize,
    total,
    pages,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(total, start + pageSize),
  };
}

/** Case-insensitive match across named fields. */
export function matchesQuery(row, query, fields) {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => String(row[field] ?? '').toLowerCase().includes(needle));
}

/** Stable comparator builder for table sorting. */
export function comparator(key, direction = 'asc') {
  const sign = direction === 'desc' ? -1 : 1;
  return (a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign;
    return String(av).localeCompare(String(bv)) * sign;
  };
}

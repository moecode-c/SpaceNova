/**
 * Tabular file parsing, for the datasets a researcher uploads.
 *
 * Parsing happens in the browser: the file never leaves the machine until the
 * researcher saves the dataset, and the row count and columns recorded on the
 * snapshot are the real ones rather than a figure somebody typed in.
 *
 * Deliberately small. It handles the delimited files that come out of a
 * spreadsheet or a `to_csv` call, including quoted fields with embedded commas
 * and newlines, and it handles JSON that is either an array of objects or an
 * object wrapping one. It is not a general CSV library, and it says so when it
 * meets something it cannot read.
 */

/** Guess the delimiter from the header line, preferring the most frequent. */
function detectDelimiter(text) {
  const firstLine = text.slice(0, text.indexOf('\n') + 1 || text.length);
  const candidates = [
    [',', 'comma'],
    ['\t', 'tab'],
    [';', 'semicolon'],
    ['|', 'pipe'],
  ];
  let best = [',', 'comma', 0];
  for (const [char, label] of candidates) {
    // Count only outside quotes, so a quoted "Cairo, Egypt" does not win.
    let count = 0;
    let quoted = false;
    for (let i = 0; i < firstLine.length; i += 1) {
      const c = firstLine[i];
      if (c === '"') quoted = !quoted;
      else if (c === char && !quoted) count += 1;
    }
    if (count > best[2]) best = [char, label, count];
  }
  return { delimiter: best[0], delimiterLabel: best[1] };
}

/**
 * Split delimited text into rows of raw string cells.
 *
 * A single pass over the characters, which is what makes quoted newlines work:
 * a line-based split cannot do it.
 */
function splitDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"' && field === '') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      // Treat CRLF as one break rather than an empty row between them.
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  // A trailing newline leaves one empty row behind.
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Infer a column's type from its values, ignoring blanks. */
function inferType(values) {
  const present = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  if (present.length === 0) return 'empty';
  const all = (test) => present.every(test);
  if (all((v) => typeof v === 'boolean' || /^(true|false)$/i.test(String(v).trim()))) return 'boolean';
  if (all((v) => String(v).trim() !== '' && Number.isFinite(Number(v)))) {
    return all((v) => Number.isInteger(Number(v))) ? 'integer' : 'number';
  }
  if (all((v) => ISO_DATE.test(String(v).trim()))) return 'timestamp';
  return 'text';
}

/** Coerce a raw cell to the column's inferred type. */
function coerce(value, type) {
  const s = typeof value === 'string' ? value.trim() : value;
  if (s === '' || s === null || s === undefined) return null;
  if (type === 'integer' || type === 'number') return Number(s);
  if (type === 'boolean') return typeof s === 'boolean' ? s : /^true$/i.test(String(s));
  return s;
}

/**
 * A stable digest of the file's bytes, as a hex string.
 *
 * SHA-256 where the browser offers it, which is everywhere this application
 * runs over HTTPS or localhost. Without it the dataset still records a digest,
 * labelled for what it is, rather than claiming a checksum it did not compute.
 */
export async function digestOf(text) {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(text);
    const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return { algorithm: 'sha256', value: hex, label: `sha256:${hex.slice(0, 32)}` };
  }
  // A 32-bit rolling sum. Enough to notice a changed file, and named honestly.
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).padStart(8, '0');
  return { algorithm: 'fnv1a32', value: hex, label: `fnv1a32:${hex}` };
}

/**
 * Parse a CSV, TSV or JSON file into fields and rows.
 *
 * @param {string} text The file's contents.
 * @param {string} filename Used only to prefer JSON parsing for a .json file.
 * @returns {{
 *   format: 'csv'|'json',
 *   delimiterLabel: string|null,
 *   fields: Array<{name: string, type: string, nullCount: number}>,
 *   rows: Array<object>,
 *   rowCount: number,
 *   truncated: boolean,
 *   warnings: string[],
 * }}
 * @throws {Error} With a message fit to show the user.
 */
export function parseTable(text, filename = '') {
  const trimmed = text.replace(/^﻿/, '').trim();
  if (trimmed === '') throw new Error('The file is empty.');

  const looksJson = /\.json$/i.test(filename) || trimmed[0] === '[' || trimmed[0] === '{';
  return looksJson ? parseJson(trimmed) : parseDelimited(trimmed, filename);
}

/** The most rows kept in memory for a dataset. Beyond this the file is sampled. */
export const ROW_LIMIT = 5000;

function finish(fields, records, warnings, extra) {
  const truncated = records.length > ROW_LIMIT;
  const rows = truncated ? records.slice(0, ROW_LIMIT) : records;
  if (truncated) {
    warnings.push(
      `The file holds ${records.length.toLocaleString()} rows. The first ${ROW_LIMIT.toLocaleString()} ` +
        'are kept in the snapshot; the recorded row count is the full one.',
    );
  }

  const typed = fields.map((name) => {
    const values = rows.map((r) => r[name]);
    const type = inferType(values);
    return {
      name,
      type,
      nullCount: values.filter((v) => v === null || v === undefined || v === '').length,
    };
  });

  const coerced = rows.map((row) => {
    const out = {};
    for (const field of typed) out[field.name] = coerce(row[field.name], field.type);
    return out;
  });

  return {
    fields: typed,
    rows: coerced,
    rowCount: records.length,
    truncated,
    warnings,
    ...extra,
  };
}

function parseDelimited(text, filename) {
  const warnings = [];
  const { delimiter, delimiterLabel } = detectDelimiter(text);
  const grid = splitDelimited(text, delimiter);

  if (grid.length === 0) throw new Error('No rows could be read from the file.');
  if (grid.length === 1) {
    throw new Error('The file has a header but no data rows.');
  }

  // Blank and duplicate headers are common out of a spreadsheet, so they are
  // named rather than rejected.
  const seen = new Map();
  const header = grid[0].map((raw, i) => {
    let name = raw.trim();
    if (name === '') name = `column_${i + 1}`;
    if (seen.has(name)) {
      const n = seen.get(name) + 1;
      seen.set(name, n);
      warnings.push(`Two columns were called "${name}". The second is "${name}_${n}".`);
      name = `${name}_${n}`;
    } else {
      seen.set(name, 1);
    }
    return name;
  });

  let ragged = 0;
  const records = grid.slice(1).map((cells) => {
    if (cells.length !== header.length) ragged += 1;
    const row = {};
    header.forEach((name, i) => {
      row[name] = cells[i] ?? '';
    });
    return row;
  });

  if (ragged > 0) {
    warnings.push(
      `${ragged} row${ragged === 1 ? '' : 's'} did not have ${header.length} values. ` +
        'Missing values were read as blank and extra ones were dropped.',
    );
  }

  return finish(header, records, warnings, {
    format: /\.tsv$/i.test(filename) || delimiter === '\t' ? 'tsv' : 'csv',
    delimiterLabel,
  });
}

function parseJson(text) {
  const warnings = [];
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`The file is not valid JSON: ${error.message}`);
  }

  let records = parsed;
  if (!Array.isArray(records)) {
    // An export often wraps the array in { data: [...] } or { rows: [...] }.
    const wrapped = ['data', 'rows', 'records', 'items', 'results'].find((key) =>
      Array.isArray(parsed?.[key]),
    );
    if (!wrapped) {
      throw new Error(
        'The JSON needs to be an array of objects, or an object with a "data" or "rows" array.',
      );
    }
    warnings.push(`The rows were read from the "${wrapped}" property.`);
    records = parsed[wrapped];
  }

  if (records.length === 0) throw new Error('The JSON array is empty.');
  if (records.some((r) => r === null || typeof r !== 'object' || Array.isArray(r))) {
    throw new Error('Every entry in the array needs to be an object with named fields.');
  }

  /*
   * JSON rows are not obliged to agree on their keys, so the union is taken in
   * first-seen order and the gaps are reported rather than hidden.
   */
  const fields = [];
  for (const record of records) {
    for (const key of Object.keys(record)) if (!fields.includes(key)) fields.push(key);
  }

  const flattened = records.map((record) => {
    const row = {};
    for (const key of fields) {
      const value = record[key];
      row[key] =
        value !== null && typeof value === 'object'
          ? JSON.stringify(value)
          : (value ?? null);
    }
    return row;
  });

  const inconsistent = records.filter((r) => Object.keys(r).length !== fields.length).length;
  if (inconsistent > 0) {
    warnings.push(
      `${inconsistent} row${inconsistent === 1 ? ' was' : 's were'} missing some fields. ` +
        'Those values were recorded as empty.',
    );
  }
  if (flattened.some((row) => fields.some((f) => typeof records[0][f] === 'object'))) {
    warnings.push('Nested objects and arrays were recorded as JSON text.');
  }

  return finish(fields, flattened, warnings, { format: 'json', delimiterLabel: null });
}

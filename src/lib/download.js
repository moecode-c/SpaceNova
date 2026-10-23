/**
 * Client-side file downloads.
 *
 * Phase 1 has no server to generate a file, and Phase 2 has no reason to: the
 * rows are already in the browser. Building the file here and handing it to the
 * browser is what the old export-history screen was standing in for, and it
 * gives the user the file immediately rather than a queued job to come back to.
 */

/** Quote a CSV field only when it needs it, which keeps the file diffable. */
function csvField(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Hand a blob to the browser as a download, then release the object URL. */
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next tick: Safari needs the URL to survive the click.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Download rows as CSV.
 *
 * @param {string} filename
 * @param {Array<object>} rows
 * @param {Array<{key: string, header: string, value?: (row: object) => unknown}>} columns
 * @param {string[]} [preamble] Comment lines written above the header, used for
 *   the citation block a dataset export carries.
 * @returns {number} The number of data rows written.
 */
export function downloadCsv(filename, rows, columns, preamble = []) {
  const lines = [
    ...preamble.flatMap((line) => line.split('\n').map((l) => `# ${l}`)),
    columns.map((c) => csvField(c.header)).join(','),
    ...rows.map((row) =>
      columns.map((c) => csvField(c.value ? c.value(row) : row[c.key])).join(','),
    ),
  ];
  saveBlob(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), filename);
  return rows.length;
}

/** Download any value as pretty-printed JSON. */
export function downloadJson(filename, value) {
  saveBlob(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }),
    filename,
  );
}

/** A filename-safe version of a title, for export filenames. */
export function fileSlug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

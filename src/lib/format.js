/**
 * Display formatting. Every number shown to the user goes through here so that
 * units, precision and the tabular-figure treatment stay consistent.
 */

const pad = (n, width = 2) => String(Math.floor(Math.abs(n))).padStart(width, '0');

/** @param {number|null|undefined} v */
export function num(v, digits = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return '--';
  return v.toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function compact(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '--';
  return v.toLocaleString('en-GB', { notation: 'compact', maximumFractionDigits: 1 });
}

export function km(v, digits = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return '--';
  return `${num(v, digits)} km`;
}

export function kms(v, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '--';
  return `${num(v, digits)} km/s`;
}

export function deg(v, digits = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return '--';
  return `${num(v, digits)}°`;
}

export function percent(v, digits = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return '--';
  return `${num(v * 100, digits)}%`;
}

export function mag(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '--';
  return `${v > 0 ? '+' : ''}${num(v, 1)}`;
}

/** Azimuth in degrees to a 16-point compass label. */
export function compass(azimuth) {
  if (azimuth === null || azimuth === undefined || Number.isNaN(azimuth)) return '--';
  const points = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ];
  const i = Math.round(((azimuth % 360) + 360) % 360 / 22.5) % 16;
  return points[i];
}

/** @param {number} seconds */
export function duration(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '--';
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${pad(s % 60)}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${pad(m % 60)}m`;
  return `${Math.floor(h / 24)}d ${pad(h % 24)}h`;
}

/** Short relative age, e.g. "4 min ago", "3 d ago". Used by every source tag. */
export function age(date, now = Date.now()) {
  if (!date) return 'unknown';
  const ms = now - new Date(date).getTime();
  const future = ms < 0;
  const abs = Math.abs(ms);
  const sec = abs / 1000;
  let out;
  if (sec < 45) out = `${Math.round(sec)} s`;
  else if (sec < 3600) out = `${Math.round(sec / 60)} min`;
  else if (sec < 86400) out = `${Math.round(sec / 3600)} h`;
  else if (sec < 2592000) out = `${Math.round(sec / 86400)} d`;
  else out = `${Math.round(sec / 2592000)} mo`;
  return future ? `in ${out}` : `${out} ago`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateShort(d) {
  if (!d) return '--';
  const t = new Date(d);
  return `${pad(t.getDate())} ${MONTHS[t.getMonth()]} ${t.getFullYear()}`;
}

export function timeShort(d, withSeconds = false) {
  if (!d) return '--';
  const t = new Date(d);
  return withSeconds
    ? `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`
    : `${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

export function dateTime(d, withSeconds = false) {
  if (!d) return '--';
  return `${dateShort(d)} ${timeShort(d, withSeconds)}`;
}

export function utcStamp(d = new Date()) {
  const t = new Date(d);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())} ${pad(
    t.getUTCHours(),
  )}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}Z`;
}

export function clockUTC(d = new Date()) {
  const t = new Date(d);
  return `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`;
}

/** Day-of-year, shown next to element-set epochs. */
export function dayOfYear(d = new Date()) {
  const t = new Date(d);
  const start = Date.UTC(t.getUTCFullYear(), 0, 0);
  return Math.floor((t.getTime() - start) / 86400000);
}

/** Signed latitude/longitude with a hemisphere letter. */
export function latLon(lat, lon, digits = 3) {
  if (lat === null || lon === null || lat === undefined || lon === undefined) return '--';
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${num(Math.abs(lat), digits)}° ${ns}, ${num(Math.abs(lon), digits)}° ${ew}`;
}

export function bytes(v) {
  if (!v) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = v;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${num(n, i === 0 ? 0 : 1)} ${units[i]}`;
}

export function hz(v) {
  if (!v) return '--';
  if (v >= 1e9) return `${num(v / 1e9, 3)} GHz`;
  if (v >= 1e6) return `${num(v / 1e6, 3)} MHz`;
  if (v >= 1e3) return `${num(v / 1e3, 1)} kHz`;
  return `${num(v, 0)} Hz`;
}

export function titleCase(s) {
  if (!s) return '';
  return s
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initials(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * How each kind of component is drawn.
 *
 * These are schematics, not photographs: a drawn bell nozzle, a drawn tank,
 * a drawn fairing. That is deliberate. A photograph of a Merlin would be
 * somebody's copyrighted image, it would not scale with the component's real
 * dimensions, and it would not tell you anything the outline does not. Every
 * shape here is driven by the part's published diameter and length, so what
 * you see is the geometry the analysis is using.
 *
 * All functions take pixel coordinates with y increasing downwards, the way
 * SVG does, and return elements rather than drawing anything themselves.
 */

import { cn } from '../../lib/cn.js';

/* ------------------------------------------------------------------ */
/* Palette                                                            */
/* ------------------------------------------------------------------ */

/**
 * Fill and stroke per kind.
 *
 * Tanks read as a lit metal cylinder, which is what the gradient is for: dark
 * at both edges, bright a third of the way across. It is the cheapest cue that
 * something is round rather than flat.
 */
const PART_EDGE = {
  tank: '#8aa6c4',
  booster: '#8aa6c4',
  interstage: '#6c7f98',
  adapter: '#6c7f98',
  fairing: '#c89098',
  payload: '#7fb3d8',
  engine: '#9aa7b8',
};

const PART_FILL = {
  tank: 'cylinder',
  booster: 'cylinder',
  interstage: 'interstage',
  adapter: 'interstage',
  fairing: 'fairing',
  payload: 'payload',
  engine: 'metal',
};

/**
 * Paint for one kind, bound to one drawing.
 *
 * Gradient ids are namespaced per SVG. Every instance on the page would
 * otherwise declare the same ids, and a reference resolves to the first match
 * in the document: hide the palette and the pad loses its fills, because the
 * gradients it was pointing at are inside a hidden subtree.
 */
export function paintFor(kind, prefix) {
  return {
    body: `url(#${prefix}-${PART_FILL[kind] ?? 'cylinder'})`,
    edge: PART_EDGE[kind] ?? PART_EDGE.tank,
  };
}

/**
 * The gradients a drawing needs, under ids unique to that drawing.
 *
 * @param {object} args
 * @param {string} args.prefix Namespace for this instance's gradient ids.
 */
export function PartDefs({ prefix }) {
  return (
    <defs>
      {/* Lit cylinder: the bright band sits left of centre, as if the light
          came from the upper left. */}
      <linearGradient id={`${prefix}-cylinder`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#24354b" />
        <stop offset="28%" stopColor="#6d89a9" />
        <stop offset="48%" stopColor="#8fa9c6" />
        <stop offset="78%" stopColor="#3d5370" />
        <stop offset="100%" stopColor="#1d2b3e" />
      </linearGradient>
      <linearGradient id={`${prefix}-interstage`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#1a2433" />
        <stop offset="30%" stopColor="#42546c" />
        <stop offset="50%" stopColor="#56687f" />
        <stop offset="80%" stopColor="#273549" />
        <stop offset="100%" stopColor="#141d29" />
      </linearGradient>
      <linearGradient id={`${prefix}-fairing`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#3c2228" />
        <stop offset="28%" stopColor="#95666d" />
        <stop offset="48%" stopColor="#b5848a" />
        <stop offset="78%" stopColor="#5e373d" />
        <stop offset="100%" stopColor="#2e1a1f" />
      </linearGradient>
      <linearGradient id={`${prefix}-payload`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#17304a" />
        <stop offset="35%" stopColor="#3f6f9e" />
        <stop offset="55%" stopColor="#5288ba" />
        <stop offset="85%" stopColor="#1e3b58" />
        <stop offset="100%" stopColor="#122536" />
      </linearGradient>
      <linearGradient id={`${prefix}-metal`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#222a35" />
        <stop offset="30%" stopColor="#707e90" />
        <stop offset="52%" stopColor="#8c99a9" />
        <stop offset="80%" stopColor="#39434f" />
        <stop offset="100%" stopColor="#1b2129" />
      </linearGradient>
      <linearGradient id={`${prefix}-flame`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8fb8ff" stopOpacity="0.9" />
        <stop offset="60%" stopColor="#4d9bff" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#4d9bff" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

/* ------------------------------------------------------------------ */
/* Shapes                                                             */
/* ------------------------------------------------------------------ */

/** An ogive nose: curved flanks meeting at a point. */
export function ogivePath(cx, yTop, yBottom, w) {
  const h = yBottom - yTop;
  const half = w / 2;
  return [
    `M ${cx - half} ${yBottom}`,
    `C ${cx - half} ${yBottom - h * 0.58}, ${cx - half * 0.34} ${yTop + h * 0.06}, ${cx} ${yTop}`,
    `C ${cx + half * 0.34} ${yTop + h * 0.06}, ${cx + half} ${yBottom - h * 0.58}, ${cx + half} ${yBottom}`,
    'Z',
  ].join(' ');
}

/** A frustum: a cone with its top cut off, joining two diameters. */
export function frustumPath(cx, yTop, yBottom, wTop, wBottom) {
  return [
    `M ${cx - wBottom / 2} ${yBottom}`,
    `L ${cx - wTop / 2} ${yTop}`,
    `L ${cx + wTop / 2} ${yTop}`,
    `L ${cx + wBottom / 2} ${yBottom}`,
    'Z',
  ].join(' ');
}

/** One engine bell: a narrow throat flaring to the exit plane. */
export function bellPath(cx, yTop, yBottom, wExit) {
  const h = Math.max(2, yBottom - yTop);
  const throat = wExit * 0.34;
  const neck = yTop + h * 0.26;
  return [
    `M ${cx - throat / 2} ${yTop}`,
    `L ${cx - throat / 2} ${neck}`,
    `C ${cx - throat / 2} ${neck + h * 0.42}, ${cx - wExit / 2} ${yBottom - h * 0.3}, ${cx - wExit / 2} ${yBottom}`,
    `L ${cx + wExit / 2} ${yBottom}`,
    `C ${cx + wExit / 2} ${yBottom - h * 0.3}, ${cx + throat / 2} ${neck + h * 0.42}, ${cx + throat / 2} ${neck}`,
    `L ${cx + throat / 2} ${yTop}`,
    'Z',
  ].join(' ');
}

/**
 * Draw one placed component.
 *
 * @param {object} args
 * @param {object} args.part        A laid-out component.
 * @param {number} args.cx          Centreline, in pixels.
 * @param {number} args.yTop        Top edge, in pixels.
 * @param {number} args.yBottom     Bottom edge, in pixels.
 * @param {number} args.w           Width from the part's diameter, in pixels.
 * @param {number} [args.wBelow]    Width of whatever is underneath, for a taper.
 * @param {number} [args.wParent]   Width of the stage an engine cluster bolts to.
 * @param {string} [args.prefix]    Namespace of the gradient ids to paint with.
 * @param {boolean} [args.selected]
 * @param {boolean} [args.ghost]    Drawn faintly, for a payload inside a fairing.
 */
export function PartShape({ part, cx, yTop, yBottom, w, wBelow, wParent, selected, ghost, prefix = 'vb' }) {
  const paint = paintFor(part.kind, prefix);
  const h = Math.max(1, yBottom - yTop);
  const half = w / 2;
  const stroke = selected ? '#7db6ff' : paint.edge;
  const strokeWidth = selected ? 1.6 : 0.7;
  const opacity = ghost ? 0.45 : 1;

  const common = {
    stroke,
    strokeWidth,
    opacity,
    vectorEffect: 'non-scaling-stroke',
  };

  switch (part.kind) {
    /* ---- fairing: an ogive, split down the middle ------------------- */
    case 'fairing':
      return (
        <g>
          <path d={ogivePath(cx, yTop, yBottom, w)} fill={paint.body} {...common} />
          <line
            x1={cx}
            y1={yTop + h * 0.08}
            x2={cx}
            y2={yBottom}
            stroke="#2a1419"
            strokeWidth="0.6"
            opacity={opacity * 0.8}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      );

    /* ---- adapter: a taper between two diameters --------------------- */
    case 'adapter':
      return (
        <path
          d={frustumPath(cx, yTop, yBottom, w, Math.max(w, wBelow ?? w))}
          fill={paint.body}
          {...common}
        />
      );

    /* ---- interstage: a short barrel with a separation plane --------- */
    case 'interstage':
      return (
        <g>
          <rect x={cx - half} y={yTop} width={w} height={h} fill={paint.body} {...common} />
          {/* The dashed line is the separation plane itself. */}
          <line
            x1={cx - half}
            y1={yTop + 0.5}
            x2={cx + half}
            y2={yTop + 0.5}
            stroke="#7db6ff"
            strokeWidth="1"
            strokeDasharray="3 2"
            opacity={opacity * 0.75}
            vectorEffect="non-scaling-stroke"
          />
          {h > 10 &&
            [0.35, 0.65].map((f) => (
              <line
                key={f}
                x1={cx - half}
                y1={yTop + h * f}
                x2={cx + half}
                y2={yTop + h * f}
                stroke="#0d131d"
                strokeWidth="0.5"
                opacity={opacity * 0.6}
                vectorEffect="non-scaling-stroke"
              />
            ))}
        </g>
      );

    /* ---- payload: a bus with solar wings ---------------------------- */
    case 'payload':
      return (
        <g opacity={opacity}>
          <rect
            x={cx - half}
            y={yTop}
            width={w}
            height={h}
            rx={Math.min(2, w * 0.12)}
            fill={paint.body}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
          {h > 12 &&
            [0.3, 0.5, 0.7].map((f) => (
              <line
                key={f}
                x1={cx - half * 0.72}
                y1={yTop + h * f}
                x2={cx + half * 0.72}
                y2={yTop + h * f}
                stroke="#0e2235"
                strokeWidth="0.5"
                opacity="0.7"
                vectorEffect="non-scaling-stroke"
              />
            ))}
        </g>
      );

    /* ---- engines: one bell per unit, up to a readable number -------- */
    case 'engine':
    case 'booster': {
      if (part.kind === 'booster') {
        // A strap-on is a small cylinder with its own nose.
        const noseH = Math.min(h * 0.22, w * 1.6);
        return (
          <g>
            <path d={ogivePath(cx, yTop, yTop + noseH, w)} fill={paint.body} {...common} />
            <rect
              x={cx - half}
              y={yTop + noseH}
              width={w}
              height={h - noseH}
              fill={paint.body}
              {...common}
            />
          </g>
        );
      }

      /*
       * Engines bolt to a thrust structure, so the cluster cannot be wider
       * than the stage above it however many are fitted. Past that point the
       * bells get narrower rather than the cluster getting wider, which is
       * what an octaweb does.
       */
      const shown = Math.min(part.count, 9);
      const limit = wParent ? wParent * 0.96 : w * 3;
      const span = Math.min(w * shown * 1.05, limit);
      const pitch = shown > 1 ? span / shown : 0;
      const start = cx - ((shown - 1) * pitch) / 2;
      const bellW = shown > 1 ? Math.min(w, pitch * 0.94) : Math.min(w, limit);
      return (
        <g>
          {Array.from({ length: shown }, (_, i) => (
            <path
              key={i}
              d={bellPath(start + i * pitch, yTop, yBottom, bellW)}
              fill={paint.body}
              {...common}
            />
          ))}
          {part.count > shown && (
            <text
              x={cx}
              y={yBottom + 7}
              textAnchor="middle"
              className="fill-ink-faint font-mono"
              style={{ fontSize: 6 }}
            >
              ×{part.count}
            </text>
          )}
        </g>
      );
    }

    /* ---- tank: a lit cylinder with ring frames ---------------------- */
    default:
      return (
        <g>
          <rect x={cx - half} y={yTop} width={w} height={h} fill={paint.body} {...common} />
          {h > 24 &&
            [0.18, 0.4, 0.62, 0.84].map((f) => (
              <line
                key={f}
                x1={cx - half}
                y1={yTop + h * f}
                x2={cx + half}
                y2={yTop + h * f}
                stroke="#101a26"
                strokeWidth="0.5"
                opacity={opacity * 0.55}
                vectorEffect="non-scaling-stroke"
              />
            ))}
        </g>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Palette glyph                                                      */
/* ------------------------------------------------------------------ */

/**
 * A miniature of a component, for the library card.
 *
 * Drawn from the same shape functions as the full drawing, so a part looks
 * the same in the library as it does on the vehicle. Proportions are the
 * part's real ones, clamped so a 70 m tank and a 0.5 m engine both stay
 * recognisable in a 40-pixel box.
 */
export function PartGlyph({ component, className }) {
  const W = 40;
  const H = 40;
  const pad = 3;

  const ratio = (component.lengthM || 1) / (component.diameterM || 1);
  // Clamp the aspect ratio: a real tank is 30:1 and would draw as a hair.
  const shown = Math.max(0.45, Math.min(5.5, ratio));
  const h = H - pad * 2;
  const w = Math.max(5, Math.min(W - pad * 2, h / shown));

  const cx = W / 2;
  const yTop = pad;
  const yBottom = H - pad;

  const part = { ...component, count: Math.min(component.kind === 'engine' ? 3 : 1, 9) };
  const prefix = `glyph-${component.id}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <PartDefs prefix={prefix} />
      <PartShape
        part={part}
        cx={cx}
        yTop={yTop}
        yBottom={yBottom}
        w={w}
        wBelow={w * 1.3}
        prefix={prefix}
      />
    </svg>
  );
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Maximize2, Minimize2, Minus, Plus } from 'lucide-react';
import { PartDefs, PartShape } from './part-shapes.jsx';
import { cn } from '../../lib/cn.js';
import { rng } from '../../lib/random.js';
import { num } from '../../lib/format.js';

/**
 * The pad: the vehicle drawn to scale, and the surface you build it on.
 *
 * Everything is driven by the layout from engine/vehicle-geometry.js, so the
 * picture and the numbers cannot disagree. A part is as long on screen as its
 * published length, and the balance markers sit where the mass and the air
 * loads actually act.
 *
 * The view is a camera over that scene rather than a fixed drawing: scroll to
 * zoom at the pointer, drag the background to pan, and the scale is honest at
 * every zoom level because the ruler is recomputed from the live transform
 * rather than being a fixed set of labels.
 *
 * Interaction with the parts is an HTML layer over the SVG, because
 * `draggable` on SVG elements is not reliable across browsers. The overlay
 * boxes line up exactly, since both come from the same transform.
 */

/** Gradient namespace for this drawing. See paintFor in part-shapes.jsx. */
const PAD = 'pad';

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 14;
const GUTTER = 62; // room for the ruler on the left
const TOP_PAD = 48;
const BOTTOM_PAD = 72; // room for the pad deck under the vehicle

/** A tick interval that keeps labels at least ~46 px apart. */
function tickStep(pxPerM) {
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 250, 500];
  return steps.find((s) => s * pxPerM >= 46) ?? 1000;
}

/** A fixed starfield. Seeded, so it does not reshuffle on every render. */
function useStars(count = 130) {
  return useMemo(() => {
    const random = rng('vehicle-pad-stars');
    return Array.from({ length: count }, () => ({
      x: random.range(0, 1),
      y: random.range(0, 1),
      r: random.range(0.35, 1.5),
      o: random.range(0.12, 0.85),
      depth: random.range(0.05, 0.4),
    }));
  }, [count]);
}

export function RocketScale({
  layout,
  cog,
  cop,
  padAccelG,
  flyable,
  selectedSlotId,
  onSelect,
  onInsert,
  onMoveSlot,
  dragKind,
  expanded,
  onToggleExpand,
}) {
  const hostRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ zoom: 1, dx: 0, dy: 0 });
  const [hoverAt, setHoverAt] = useState(null);
  const [draggingSlot, setDraggingSlot] = useState(null);
  const [panning, setPanning] = useState(false);
  const stars = useStars();

  const { items, boosters, totalLengthM, maxDiameterM } = layout;
  const empty = items.length === 0;

  /* ---- the canvas measures itself ------------------------------------ */
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize({ w: Math.round(box.width), h: Math.round(box.height) });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  /* ---- the camera ----------------------------------------------------- */

  const shownLengthM = Math.max(totalLengthM, 2);
  const shownWidthM = Math.max(maxDiameterM * 3.4, 6);

  /** The zoom at which the whole vehicle just fits. Zoom is relative to this. */
  const fitScale = useMemo(() => {
    if (!size.w || !size.h) return 1;
    return Math.min(
      (size.h - TOP_PAD - BOTTOM_PAD) / shownLengthM,
      (size.w - GUTTER - 120) / shownWidthM,
    );
  }, [size.w, size.h, shownLengthM, shownWidthM]);

  const scale = Math.max(0.01, fitScale * view.zoom);
  const cx = GUTTER + (size.w - GUTTER) / 2 + view.dx;
  const groundY = size.h - BOTTOM_PAD + view.dy;

  const toY = useCallback((m) => groundY - m * scale, [groundY, scale]);
  const toW = useCallback((d) => Math.max(1, (d ?? 0.5) * scale), [scale]);

  const fit = useCallback(() => setView({ zoom: 1, dx: 0, dy: 0 }), []);

  /** Zoom about a point, so whatever is under the pointer stays under it. */
  const zoomAt = useCallback(
    (factor, px, py) => {
      setView((v) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
        if (next === v.zoom) return v;
        const s0 = fitScale * v.zoom;
        const s1 = fitScale * next;
        const cx0 = GUTTER + (size.w - GUTTER) / 2 + v.dx;
        const gy0 = size.h - BOTTOM_PAD + v.dy;
        const worldX = (px - cx0) / s0;
        const worldY = (gy0 - py) / s0;
        return {
          zoom: next,
          dx: px - worldX * s1 - (GUTTER + (size.w - GUTTER) / 2),
          dy: py + worldY * s1 - (size.h - BOTTOM_PAD),
        };
      });
    },
    [fitScale, size.w, size.h],
  );

  /*
   * Wheel-to-zoom needs a non-passive listener, which React's synthetic
   * handler cannot give: without preventDefault the page scrolls instead.
   */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const box = host.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0014), e.clientX - box.left, e.clientY - box.top);
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  /** Drag the background to pan. Parts sit in their own layer above this. */
  const startPan = (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    const from = { x: e.clientX, y: e.clientY };
    const base = view;
    setPanning(true);
    const move = (ev) =>
      setView({ ...base, dx: base.dx + ev.clientX - from.x, dy: base.dy + ev.clientY - from.y });
    const up = () => {
      setPanning(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onKeyDown = (e) => {
    if (e.key === '0') fit();
    else if (e.key === '+' || e.key === '=') zoomAt(1.25, size.w / 2, size.h / 2);
    else if (e.key === '-' || e.key === '_') zoomAt(0.8, size.w / 2, size.h / 2);
    else return;
    e.preventDefault();
  };

  /* ---- drop targets ---------------------------------------------------- */

  const boundaries = useMemo(() => {
    const inline = items.filter((i) => !i.enclosed);
    const out = inline.map((item) => ({ index: item.stackIndex, yM: item.yBottom }));
    out.push({ index: items.length, yM: totalLengthM });
    return out.sort((a, b) => a.yM - b.yM);
  }, [items, totalLengthM]);

  const nearestBoundary = (clientY) => {
    const box = hostRef.current?.getBoundingClientRect();
    if (!box || boundaries.length === 0) return null;
    const metres = (groundY - (clientY - box.top)) / scale;
    return boundaries.reduce(
      (best, b) => (Math.abs(b.yM - metres) < Math.abs(best.yM - metres) ? b : best),
      boundaries[0],
    );
  };

  const handleDragOver = (e) => {
    if (!dragKind && !draggingSlot) return;
    e.preventDefault();
    setHoverAt(nearestBoundary(e.clientY));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const target = nearestBoundary(e.clientY);
    setHoverAt(null);
    if (!target) return;
    const slotId = e.dataTransfer.getData('application/x-spacenova-slot');
    const componentId = e.dataTransfer.getData('application/x-spacenova-component');
    if (slotId) onMoveSlot?.(slotId, target.index);
    else if (componentId) onInsert?.(componentId, target.index);
    setDraggingSlot(null);
  };

  /* ---- ruler ----------------------------------------------------------- */

  const ticks = useMemo(() => {
    if (!size.h) return [];
    const step = tickStep(scale);
    const top = (groundY - TOP_PAD) / scale;
    const bottom = (groundY - size.h) / scale;
    const from = Math.max(0, Math.floor(bottom / step) * step);
    const to = Math.min(shownLengthM * 1.35 + step, Math.ceil(top / step) * step);
    const out = [];
    for (let m = from; m <= to + 1e-6; m += step) {
      out.push({ m: Number(m.toFixed(4)), step });
      if (out.length > 200) break;
    }
    return out;
  }, [scale, groundY, size.h, shownLengthM]);

  const padDeckHalf = Math.max(toW(maxDiameterM) * 1.5, 40);
  const towerX = cx + padDeckHalf * 0.78;
  const towerW = Math.max(10, toW(maxDiameterM) * 0.34);
  const towerTop = toY(totalLengthM * 1.04);

  return (
    <div
      ref={hostRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={startPan}
      onDragOver={handleDragOver}
      onDragLeave={() => setHoverAt(null)}
      onDrop={handleDrop}
      className={cn(
        'relative h-full w-full select-none overflow-hidden outline-none',
        'bg-void',
        panning ? 'cursor-grabbing' : 'cursor-grab',
      )}
      role="application"
      aria-label="Launch pad. Scroll to zoom, drag to pan."
    >
      {size.w > 0 && (
        <svg width={size.w} height={size.h} className="block">
          <PartDefs prefix={PAD} />
          <defs>
            <radialGradient id={`${PAD}-exhaust`} cx="50%" cy="0%" r="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="35%" stopColor="#ffffff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${PAD}-horizon`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.13" />
            </linearGradient>
            <linearGradient id={`${PAD}-deck`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#393c41" />
              <stop offset="100%" stopColor="#1a1c1e" />
            </linearGradient>
          </defs>

          {/* ---- sky: stars drift a little against the pan, for depth --- */}
          <g>
            {stars.map((s, i) => (
              <circle
                key={i}
                cx={(s.x * size.w + view.dx * s.depth + size.w) % size.w}
                cy={(s.y * size.h + view.dy * s.depth + size.h) % size.h}
                r={s.r}
                fill="#dee2e6"
                opacity={s.o}
              />
            ))}
          </g>

          {/* ---- a faint world grid, so zoom reads as zoom -------------- */}
          {ticks.length > 1 && (
            <g opacity="0.5">
              {ticks.map(({ m }) => (
                <line
                  key={`g${m}`}
                  x1={GUTTER}
                  y1={toY(m)}
                  x2={size.w}
                  y2={toY(m)}
                  stroke="#202224"
                  strokeWidth="1"
                />
              ))}
            </g>
          )}

          {/* ---- horizon glow above the pad ----------------------------- */}
          <rect
            x="0"
            y={Math.max(0, groundY - 190)}
            width={size.w}
            height={Math.min(190, Math.max(0, groundY))}
            fill={`url(#${PAD}-horizon)`}
          />

          {/* ---- service tower ------------------------------------------ */}
          {!empty && towerTop < groundY && (
            <g opacity="0.85">
              <rect
                x={towerX}
                y={towerTop}
                width={towerW}
                height={groundY - towerTop}
                fill="#18191b"
                stroke="#323438"
                strokeWidth="1"
              />
              {/* lattice */}
              {Array.from(
                { length: Math.max(0, Math.min(60, Math.floor((groundY - towerTop) / 22))) },
                (_, i) => {
                  const y = towerTop + i * 22;
                  return (
                    <g key={i} stroke="#3b3e42" strokeWidth="1">
                      <line x1={towerX} y1={y} x2={towerX + towerW} y2={y} />
                      <line x1={towerX} y1={y} x2={towerX + towerW} y2={y + 22} />
                    </g>
                  );
                },
              )}
              {/* umbilical arm reaching the upper stage */}
              <rect
                x={cx + toW(maxDiameterM) / 2}
                y={toY(totalLengthM * 0.62)}
                width={Math.max(2, towerX - cx - toW(maxDiameterM) / 2)}
                height={Math.max(2, toW(maxDiameterM) * 0.07)}
                fill="#3b3e42"
              />
            </g>
          )}

          {/* ---- exhaust, when the thing can actually leave the pad ----- */}
          {flyable && !empty && (
            <ellipse
              cx={cx}
              cy={groundY + 6}
              rx={Math.max(18, toW(maxDiameterM) * 0.85)}
              ry={Math.max(26, toW(maxDiameterM) * 1.5)}
              fill={`url(#${PAD}-exhaust)`}
            />
          )}

          {/* ---- the vehicle -------------------------------------------- */}
          {boosters.map((b) =>
            boosterOffsets(b.count, toW(b.diameterM), toW(maxDiameterM)).map((off, i) => (
              <PartShape
                key={`${b.slotId}-${i}`}
                part={b}
                cx={cx + off}
                yTop={toY(b.yTop)}
                yBottom={toY(b.yBottom)}
                w={toW(b.diameterM)}
                selected={selectedSlotId === b.slotId}
                prefix={PAD}
              />
            )),
          )}

          {items.map((item, i) => (
            <PartShape
              key={item.slotId}
              part={item}
              cx={cx}
              yTop={toY(item.yTop)}
              yBottom={toY(item.yBottom)}
              w={toW(item.diameterM)}
              wBelow={items[i - 1] ? toW(items[i - 1].diameterM) : undefined}
              wParent={items[i + 1] ? toW(items[i + 1].diameterM) : undefined}
              selected={selectedSlotId === item.slotId}
              ghost={item.enclosed}
              prefix={PAD}
            />
          ))}

          {/* ---- section labels ----------------------------------------- */}
          {items
            .filter((i) => i.kind !== 'engine' && toY(i.yBottom) - toY(i.yTop) > 18)
            .map((item) => {
              const label = sectionLabel(item);
              if (!label) return null;
              const yMid = (toY(item.yTop) + toY(item.yBottom)) / 2;
              const w = Math.max(20, Math.min(34, toW(item.diameterM) * 0.62));
              return (
                <g key={`label-${item.slotId}`} opacity="0.95">
                  <rect
                    x={cx - w / 2}
                    y={yMid - 7}
                    width={w}
                    height={14}
                    rx={3}
                    fill="#08090a"
                    opacity="0.78"
                  />
                  <text
                    x={cx}
                    y={yMid + 4}
                    textAnchor="middle"
                    className="fill-ink-dim font-mono"
                    style={{ fontSize: 9 }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}

          {/* ---- balance markers ----------------------------------------- */}
          {!empty &&
            [
              cop && { yM: cop.yM, key: 'CoP', colour: '#e8ac4a', label: 'CoP' },
              cog && { yM: cog.yM, key: 'CoG', colour: '#3fd49b', label: 'CoG' },
            ]
              .filter(Boolean)
              .map((marker) => {
                const y = toY(marker.yM);
                if (y < TOP_PAD - 20 || y > size.h + 20) return null;
                const half = Math.max(toW(maxDiameterM) / 2 + 26, 46);
                return (
                  <g key={marker.key}>
                    <line
                      x1={cx - half}
                      y1={y}
                      x2={cx + half}
                      y2={y}
                      stroke={marker.colour}
                      strokeWidth="1.1"
                      strokeDasharray="4 3"
                    />
                    <circle cx={cx - half} cy={y} r="2.6" fill={marker.colour} />
                    <circle cx={cx + half} cy={y} r="2.6" fill={marker.colour} />
                    <text
                      x={cx + half + 7}
                      y={y + 3.5}
                      className="font-mono"
                      fill={marker.colour}
                      style={{ fontSize: 10 }}
                    >
                      {marker.label}
                    </text>
                    <text
                      x={cx - half - 7}
                      y={y + 3.5}
                      textAnchor="end"
                      className="font-mono"
                      fill={marker.colour}
                      opacity="0.65"
                      style={{ fontSize: 9 }}
                    >
                      {num(marker.yM, 1)} m
                    </text>
                  </g>
                );
              })}

          {/* ---- pad deck ------------------------------------------------ */}
          <g>
            <rect
              x={cx - padDeckHalf}
              y={groundY}
              width={padDeckHalf * 2}
              height={12}
              fill={`url(#${PAD}-deck)`}
              stroke="#3b3e42"
              strokeWidth="1"
            />
            {/* flame trench */}
            <path
              d={`M ${cx - padDeckHalf * 0.42} ${groundY + 12} L ${cx - padDeckHalf * 0.3} ${groundY + 34} L ${cx + padDeckHalf * 0.3} ${groundY + 34} L ${cx + padDeckHalf * 0.42} ${groundY + 12} Z`}
              fill="#0b0c0d"
              stroke="#232326"
              strokeWidth="1"
            />
            <line
              x1="0"
              y1={groundY}
              x2={size.w}
              y2={groundY}
              stroke="#e8ac4a"
              strokeWidth="1"
              opacity="0.35"
            />
          </g>

          {/* ---- ruler, recomputed from the live transform ------------- */}
          <g>
            <rect x="0" y="0" width={GUTTER} height={size.h} fill="#08090a" opacity="0.72" />
            <line x1={GUTTER - 1} y1="0" x2={GUTTER - 1} y2={size.h} stroke="#232326" strokeWidth="1" />
            {ticks.map(({ m, step }) => (
              <g key={`t${m}`}>
                <line
                  x1={GUTTER - 7}
                  y1={toY(m)}
                  x2={GUTTER - 1}
                  y2={toY(m)}
                  stroke="#e8ac4a"
                  strokeWidth="1"
                  opacity="0.75"
                />
                <text
                  x={GUTTER - 11}
                  y={toY(m) + 3.5}
                  textAnchor="end"
                  className="fill-ink-faint font-mono"
                  style={{ fontSize: 9.5 }}
                >
                  {step < 1 ? m.toFixed(1) : m.toFixed(0)}
                </text>
              </g>
            ))}
            {!empty && toY(totalLengthM) > 12 && (
              <text
                x={GUTTER - 11}
                y={toY(totalLengthM) - 8}
                textAnchor="end"
                className="fill-warn font-mono"
                style={{ fontSize: 10 }}
              >
                {num(totalLengthM, 1)} m
              </text>
            )}
          </g>

          {/* ---- insertion line ------------------------------------------ */}
          {hoverAt && (
            <g>
              <line
                x1={GUTTER}
                y1={toY(hoverAt.yM)}
                x2={size.w}
                y2={toY(hoverAt.yM)}
                stroke="#f0f0fa"
                strokeWidth="2"
              />
              <circle cx={GUTTER + 8} cy={toY(hoverAt.yM)} r="3.4" fill="#f0f0fa" />
            </g>
          )}

          {empty && (
            <text
              x={GUTTER + (size.w - GUTTER) / 2}
              y={groundY - 56}
              textAnchor="middle"
              className="fill-ink-faint"
              style={{ fontSize: 12 }}
            >
              Drag a component onto the pad
            </text>
          )}
        </svg>
      )}

      {/* ---- the interaction layer ------------------------------------ */}
      <div className="pointer-events-none absolute inset-0">
        {boosters.map((b) => {
          const off = boosterOffsets(b.count, toW(b.diameterM), toW(maxDiameterM))[0];
          return (
            <HitBox
              key={`hit-${b.slotId}`}
              label={`${b.count > 1 ? `${b.count} ` : ''}${b.name}, strap-on`}
              slotId={b.slotId}
              left={cx + off}
              top={toY(b.yTop)}
              bottom={toY(b.yBottom)}
              width={Math.max(toW(b.diameterM), 16)}
              selected={selectedSlotId === b.slotId}
              dragging={draggingSlot === b.slotId}
              onSelect={onSelect}
              onDragStart={setDraggingSlot}
              onDragEnd={() => {
                setDraggingSlot(null);
                setHoverAt(null);
              }}
            />
          );
        })}

        {items.map((item) => (
          <HitBox
            key={`hit-${item.slotId}`}
            label={`${item.name}, ${num(item.lengthM, 1)} metres`}
            slotId={item.slotId}
            left={cx}
            top={toY(item.yTop)}
            bottom={toY(item.yBottom)}
            width={Math.max(toW(item.diameterM), 18)}
            selected={selectedSlotId === item.slotId}
            dragging={draggingSlot === item.slotId}
            draggable={!item.enclosed}
            onSelect={onSelect}
            onDragStart={setDraggingSlot}
            onDragEnd={() => {
              setDraggingSlot(null);
              setHoverAt(null);
            }}
          />
        ))}
      </div>

      {/* ---- heads-up readouts ----------------------------------------- */}
      {padAccelG !== null && padAccelG !== undefined && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-md border border-line bg-void/85 px-3 py-1.5">
          <span className="tnum font-mono text-xs">
            <span className="text-ink-faint">Pad accel </span>
            <span className={padAccelG > 0 ? 'text-good' : 'text-bad'}>
              {num(padAccelG, 2)} g
            </span>
          </span>
        </div>
      )}

      {/* ---- camera controls -------------------------------------------- */}
      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-md border border-line bg-void/85 p-1">
        <PadButton label="Zoom out" onClick={() => zoomAt(0.8, size.w / 2, size.h / 2)}>
          <Minus size={13} aria-hidden />
        </PadButton>
        <button
          type="button"
          onClick={fit}
          className="tnum min-w-[3.2rem] rounded px-1.5 py-1 text-center font-mono text-2xs text-ink-dim transition-colors hover:bg-overlay hover:text-ink"
          title="Fit the vehicle to the view (0)"
        >
          {Math.round(view.zoom * 100)}%
        </button>
        <PadButton label="Zoom in" onClick={() => zoomAt(1.25, size.w / 2, size.h / 2)}>
          <Plus size={13} aria-hidden />
        </PadButton>
        <span className="mx-0.5 h-4 w-px bg-line" aria-hidden />
        <PadButton label="Fit to view" onClick={fit}>
          <Crosshair size={13} aria-hidden />
        </PadButton>
        <PadButton
          label={expanded ? 'Show the side panels' : 'Expand the pad'}
          onClick={onToggleExpand}
        >
          {expanded ? <Minimize2 size={13} aria-hidden /> : <Maximize2 size={13} aria-hidden />}
        </PadButton>
      </div>

      <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-2xs text-ink-faint/80">
        Scroll to zoom · drag to pan · click a section to select it
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PadButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded p-1.5 text-ink-faint transition-colors hover:bg-overlay hover:text-ink"
    >
      {children}
    </button>
  );
}

/** A transparent box over a drawn part: the thing you actually click and drag. */
function HitBox({
  label, slotId, left, top, bottom, width, selected, dragging,
  draggable = true, onSelect, onDragStart, onDragEnd,
}) {
  return (
    <button
      type="button"
      draggable={draggable}
      onPointerDown={(e) => e.stopPropagation()}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-spacenova-slot', slotId);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(slotId);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onSelect?.(slotId)}
      aria-label={label}
      className={cn(
        'pointer-events-auto absolute -translate-x-1/2 rounded-sm transition-shadow',
        selected
          ? 'shadow-[0_0_0_1.5px_rgba(255,255,255,0.95)]'
          : 'hover:shadow-[0_0_0_1.5px_rgba(255,255,255,0.5)]',
        dragging && 'opacity-40',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
      )}
      style={{
        left,
        top,
        height: Math.max(6, bottom - top),
        width,
      }}
    />
  );
}

/**
 * Where strap-ons sit either side of the core, in a side view.
 *
 * As many are drawn as are fitted, up to six, alternating sides so a pair
 * reads as a pair. An odd number really does sit asymmetrically, and the
 * drawing shows that rather than tidying it away.
 */
function boosterOffsets(count, w, coreW) {
  const first = coreW / 2 + w / 2 + 2;
  const pitch = w + 3;
  const shown = Math.min(Math.max(1, count), 6);
  return Array.from({ length: shown }, (_, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    return side * (first + Math.floor(i / 2) * pitch);
  });
}

function sectionLabel(item) {
  if (item.kind === 'fairing') return 'FN';
  if (item.kind === 'payload') return 'PL';
  if (item.kind === 'interstage') return 'IS';
  if (item.kind === 'adapter') return 'AD';
  return item.stage ? `S${item.stage}` : null;
}

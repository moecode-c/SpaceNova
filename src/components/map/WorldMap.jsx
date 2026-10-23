import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoCircle, geoEquirectangular, geoOrthographic, geoPath } from 'd3-geo';
import { cn } from '../../lib/cn.js';
import { BORDERS, GRATICULE, LAND, SPHERE } from './world-data.js';
import { sunPosition, RAD } from '../../engine/sun.js';
import { gmstFor } from '../../engine/propagate.js';
import { clamp } from '../../lib/random.js';

// Greyscale, like the rest of the system: the only colour on the map is the
// observer marker and the launch pads, which are status marks.
const PALETTE = {
  ocean: '#0c0c0e',
  land: '#1d1d21',
  landStroke: '#34343a',
  border: '#26262b',
  graticule: 'rgba(255,255,255,0.05)',
  sphereStroke: '#3a3a3f',
  night: 'rgba(0,0,0,0.64)',
  terminator: 'rgba(255,255,255,0.3)',
  observer: '#3fd49b',
  footprint: 'rgba(255,255,255,0.06)',
  footprintStroke: 'rgba(255,255,255,0.45)',
};

/** Sub-solar point, for the day and night shading. */
function subsolarPoint(date) {
  const { ra, dec } = sunPosition(date);
  const gmst = gmstFor(date);
  let lon = (ra - gmst) * RAD;
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return [lon, dec * RAD];
}

/**
 * Vector world map, drawn to a canvas.
 *
 * Two projections share one renderer: an equirectangular plate carree for the
 * flat view and an orthographic globe that can be dragged. Satellite positions,
 * ground tracks and footprints arrive already computed by the engine; this
 * component only projects and paints them.
 */
export function WorldMap({
  mode = 'flat',
  satellites = [],
  tracks = [],
  observer,
  stations = [],
  pads = [],
  selectedId,
  onSelect,
  showTerminator = true,
  showGraticule = true,
  showFootprints = true,
  showLabels = true,
  className,
  height = 420,
  interactive = true,
  autoRotate = false,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [measuredWidth, setMeasuredWidth] = useState(960);
  const [rotation, setRotation] = useState([20, -12]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState([0, 0]);
  const dragState = useRef(null);
  const hitBoxes = useRef([]);

  // Track the container width so the canvas is always crisp.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const observerRo = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setMeasuredWidth(Math.max(280, Math.round(rect.width)));
    });
    observerRo.observe(node);
    return () => observerRo.disconnect();
  }, []);

  // A slow turn for the landing hero, where the globe is scenery rather than a
  // control. It stands still for anybody who has asked for reduced motion, and
  // while the globe is being dragged.
  useEffect(() => {
    if (!autoRotate || mode !== 'globe') return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setInterval(() => {
      if (dragState.current) return;
      setRotation(([lon, lat]) => [lon + 0.35, lat]);
    }, 50);
    return () => clearInterval(timer);
  }, [autoRotate, mode]);

  // An equirectangular map is 2:1 and a globe is 1:1. Holding the requested
  // height on a narrow container would letterbox the drawing inside a tall
  // black box, so take whichever of the two is smaller.
  const size = useMemo(() => {
    const fitted = Math.round(measuredWidth / (mode === 'globe' ? 1 : 2));
    return { width: measuredWidth, height: Math.max(170, Math.min(height, fitted)) };
  }, [measuredWidth, height, mode]);

  const projection = useMemo(() => {
    const base = mode === 'globe' ? geoOrthographic() : geoEquirectangular();
    base.fitSize([size.width, size.height], SPHERE);
    const fitted = base.scale();
    if (mode === 'globe') {
      base.rotate([rotation[0], rotation[1], 0]).scale(fitted * zoom * 0.96);
      base.translate([size.width / 2, size.height / 2]);
    } else {
      base.scale(fitted * zoom);
      base.translate([size.width / 2 + pan[0], size.height / 2 + pan[1]]);
    }
    return base;
  }, [mode, size.width, size.height, rotation, zoom, pan]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    // The CSS width is a percentage, never the measured pixel value. A pixel
    // width here would prop open an auto-sized grid column, which in turn stops
    // the ResizeObserver from ever seeing the container shrink: the map would
    // latch at the widest size it was ever rendered at and push the page into
    // horizontal scroll on every narrower viewport.
    canvas.style.width = '100%';
    canvas.style.height = `${size.height}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);

    const path = geoPath(projection, ctx);

    // Ocean / sphere background.
    ctx.beginPath();
    path(SPHERE);
    ctx.fillStyle = PALETTE.ocean;
    ctx.fill();

    if (showGraticule) {
      ctx.beginPath();
      path(GRATICULE);
      ctx.strokeStyle = PALETTE.graticule;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // Land and borders.
    ctx.beginPath();
    path(LAND);
    ctx.fillStyle = PALETTE.land;
    ctx.fill();
    ctx.strokeStyle = PALETTE.landStroke;
    ctx.lineWidth = 0.7;
    ctx.stroke();

    ctx.beginPath();
    path(BORDERS);
    ctx.strokeStyle = PALETTE.border;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Night side: a 90 degree cap centred on the anti-solar point.
    if (showTerminator) {
      const [lon, lat] = subsolarPoint(new Date());
      const night = geoCircle().center([lon + 180, -lat]).radius(90)();
      ctx.beginPath();
      path(night);
      ctx.fillStyle = PALETTE.night;
      ctx.fill();
      ctx.strokeStyle = PALETTE.terminator;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Sphere outline, drawn last on the globe so it sits above the shading.
    if (mode === 'globe') {
      ctx.beginPath();
      path(SPHERE);
      ctx.strokeStyle = PALETTE.sphereStroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Footprints of the selected objects.
    if (showFootprints) {
      for (const sat of satellites) {
        if (!sat.footprintAngleDeg) continue;
        const isSelected = sat.id === selectedId;
        if (!isSelected && satellites.length > 3) continue;
        const circle = geoCircle()
          .center([sat.longitude, sat.latitude])
          .radius(sat.footprintAngleDeg)();
        ctx.beginPath();
        path(circle);
        ctx.fillStyle = PALETTE.footprint;
        ctx.fill();
        ctx.strokeStyle = isSelected ? PALETTE.footprintStroke : 'rgba(255,255,255,0.22)';
        ctx.lineWidth = isSelected ? 1 : 0.7;
        ctx.setLineDash(isSelected ? [] : [3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Ground tracks.
    for (const track of tracks) {
      const isSelected = track.id === selectedId;
      ctx.strokeStyle = track.colour ?? '#ffffff';
      ctx.globalAlpha = isSelected ? 0.95 : 0.4;
      ctx.lineWidth = isSelected ? 1.6 : 1;
      ctx.setLineDash(track.dashed ? [4, 4] : []);
      for (const segment of track.segments ?? []) {
        ctx.beginPath();
        path({
          type: 'LineString',
          coordinates: segment.map((p) => [p.longitude, p.latitude]),
        });
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Launch pads, then stations, then the observer: smallest markers first.
    for (const pad of pads) {
      const point = projection([pad.longitude, pad.latitude]);
      if (!point || !isVisible(projection, mode, [pad.longitude, pad.latitude])) continue;
      ctx.beginPath();
      ctx.moveTo(point[0], point[1] - 4);
      ctx.lineTo(point[0] + 3.4, point[1] + 2.4);
      ctx.lineTo(point[0] - 3.4, point[1] + 2.4);
      ctx.closePath();
      ctx.fillStyle = 'rgba(232,172,74,0.85)';
      ctx.fill();
    }

    for (const station of stations) {
      const point = projection([station.longitude, station.latitude]);
      if (!point || !isVisible(projection, mode, [station.longitude, station.latitude])) continue;
      ctx.beginPath();
      ctx.arc(point[0], point[1], 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#d2d2e6';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    if (observer) {
      const point = projection([observer.longitude, observer.latitude]);
      if (point && isVisible(projection, mode, [observer.longitude, observer.latitude])) {
        ctx.beginPath();
        ctx.arc(point[0], point[1], 4.5, 0, Math.PI * 2);
        ctx.strokeStyle = PALETTE.observer;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(point[0], point[1], 1.6, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.observer;
        ctx.fill();
        if (showLabels && observer.name) {
          drawLabel(ctx, observer.name, point[0] + 8, point[1] + 3.5, PALETTE.observer);
        }
      }
    }

    // Satellites last, so they are never hidden by the geometry.
    hitBoxes.current = [];
    for (const sat of satellites) {
      const coords = [sat.longitude, sat.latitude];
      if (!isVisible(projection, mode, coords)) continue;
      const point = projection(coords);
      if (!point) continue;

      const isSelected = sat.id === selectedId;
      const colour = sat.colour ?? '#ffffff';
      const radius = isSelected ? 5 : 3.6;

      hitBoxes.current.push({ id: sat.id, x: point[0], y: point[1] });

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(point[0], point[1], radius + 4.5, 0, Math.PI * 2);
        ctx.strokeStyle = colour;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // A hollow marker when the object is in shadow, filled when it is sunlit.
      ctx.beginPath();
      ctx.arc(point[0], point[1], radius, 0, Math.PI * 2);
      if (sat.eclipsed) {
        ctx.fillStyle = PALETTE.ocean;
        ctx.fill();
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = colour;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      if (showLabels && (isSelected || satellites.length <= 10)) {
        drawLabel(ctx, sat.name, point[0] + radius + 5, point[1] + 3.5, isSelected ? '#ffffff' : '#c4c4cc');
      }
    }
  }, [
    projection, size, satellites, tracks, observer, stations, pads,
    selectedId, showTerminator, showGraticule, showFootprints, showLabels, mode,
  ]);

  useEffect(() => {
    const frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [draw]);

  /* ----------------------------------------------------------- interaction */

  const onPointerDown = (e) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    dragState.current = {
      x: e.clientX,
      y: e.clientY,
      startRotation: rotation,
      startPan: pan,
      moved: false,
      downAt: [e.clientX - rect.left, e.clientY - rect.top],
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!interactive || !dragState.current) return;
    const dx = e.clientX - dragState.current.x;
    const dy = e.clientY - dragState.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragState.current.moved = true;
    if (mode === 'globe') {
      const sensitivity = 0.32 / zoom;
      setRotation([
        dragState.current.startRotation[0] + dx * sensitivity,
        clamp(dragState.current.startRotation[1] - dy * sensitivity, -89, 89),
      ]);
    } else {
      setPan([dragState.current.startPan[0] + dx, dragState.current.startPan[1] + dy]);
    }
  };

  const onPointerUp = (e) => {
    if (!interactive) return;
    const state = dragState.current;
    dragState.current = null;
    if (!state || state.moved || !onSelect) return;

    // A click without a drag selects the nearest marker inside 12 pixels.
    // Hit boxes are in projection space, which is only the same as CSS space
    // once the ResizeObserver has caught up, so scale the pointer into it.
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = rect.width > 0 ? size.width / rect.width : 1;
    const px = (e.clientX - rect.left) * scale;
    const py = (e.clientY - rect.top) * scale;
    let best = null;
    let bestDistance = 12;
    for (const box of hitBoxes.current) {
      const distance = Math.hypot(box.x - px, box.y - py);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = box.id;
      }
    }
    if (best) onSelect(best);
  };

  const onWheel = (e) => {
    if (!interactive) return;
    e.preventDefault();
    setZoom((z) => clamp(z * (e.deltaY > 0 ? 0.9 : 1.1), 1, 8));
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full min-w-0 overflow-hidden rounded-card border border-line-strong bg-void',
        className,
      )}
      style={{ height: size.height }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`World map showing ${satellites.length} tracked objects`}
        className={cn(
          'block select-none',
          // A non-interactive map is scenery and must not trap touch scrolling.
          interactive
            ? cn('touch-none', mode === 'globe' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair')
            : 'pointer-events-none',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragState.current = null; }}
        onWheel={onWheel}
      />
      {interactive && (zoom !== 1 || pan[0] !== 0 || pan[1] !== 0) && (
        <button
          type="button"
          onClick={() => {
            setZoom(1);
            setPan([0, 0]);
            setRotation([20, -12]);
          }}
          className="absolute bottom-3 right-3 rounded-full border border-line-strong bg-base px-3 py-1 text-2xs font-bold uppercase tracking-micro text-ink-dim transition-colors hover:border-ink hover:text-ink"
        >
          Reset view
        </button>
      )}
    </div>
  );
}

function drawLabel(ctx, text, x, y, colour) {
  ctx.font = '600 10px Barlow, "D-DIN", Arial, sans-serif';
  ctx.textAlign = 'left';
  const width = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(x - 2, y - 9, width + 4, 12);
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
}

/** On the globe, hide anything on the far side. */
function isVisible(projection, mode, coords) {
  if (mode !== 'globe') return true;
  const rotate = projection.rotate();
  const toRad = Math.PI / 180;
  const centreLon = -rotate[0] * toRad;
  const centreLat = -rotate[1] * toRad;
  const lon = coords[0] * toRad;
  const lat = coords[1] * toRad;
  const cosAngle =
    Math.sin(centreLat) * Math.sin(lat) +
    Math.cos(centreLat) * Math.cos(lat) * Math.cos(lon - centreLon);
  return cosAngle > 0;
}

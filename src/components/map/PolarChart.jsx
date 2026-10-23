import { useMemo } from 'react';
import { cn } from '../../lib/cn.js';
import { compass, deg, timeShort } from '../../lib/format.js';
import { maskElevationAt } from '../../engine/visibility.js';

/**
 * Sky plot.
 *
 * Azimuth around, elevation from the rim (0 degrees) to the centre (zenith).
 * The horizon obstruction mask is shaded so a pass that clears the elevation
 * threshold but is blocked by a building can be seen to be blocked, which is
 * the fourth visibility clause in SRS Appendix A.5.
 */
export function PolarPassChart({
  track = [],
  horizonMask,
  minElevation = 10,
  size = 300,
  className,
  showTimes = true,
  highlightIndex,
}) {
  const centre = size / 2;
  const radius = centre - 26;

  const project = (azimuth, elevation) => {
    const r = radius * (1 - Math.max(0, Math.min(90, elevation)) / 90);
    const theta = ((azimuth - 90) * Math.PI) / 180;
    return [centre + r * Math.cos(theta), centre + r * Math.sin(theta)];
  };

  const maskPath = useMemo(() => {
    if (!horizonMask || horizonMask.every((v) => v === 0)) return null;
    const outer = [];
    const inner = [];
    for (let a = 0; a <= 360; a += 3) {
      outer.push(project(a, 0));
      inner.push(project(a, maskElevationAt(horizonMask, a)));
    }
    const d = [
      `M ${outer[0][0]} ${outer[0][1]}`,
      ...outer.slice(1).map((p) => `L ${p[0]} ${p[1]}`),
      'Z',
      `M ${inner[0][0]} ${inner[0][1]}`,
      ...inner.slice(1).map((p) => `L ${p[0]} ${p[1]}`),
      'Z',
    ].join(' ');
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizonMask, size]);

  // Split the track into lit and unlit runs so illumination reads at a glance.
  const runs = useMemo(() => {
    const out = [];
    let current = null;
    for (const point of track) {
      if (!current || current.illuminated !== point.illuminated) {
        current = { illuminated: point.illuminated, points: [] };
        out.push(current);
        // Repeat the junction point so the runs join up.
        const previous = track[track.indexOf(point) - 1];
        if (previous) current.points.push(previous);
      }
      current.points.push(point);
    }
    return out;
  }, [track]);

  const aos = track[0];
  const los = track.at(-1);
  const tca = track.reduce((best, p) => (!best || p.elevation > best.elevation ? p : best), null);
  const highlighted = highlightIndex !== undefined ? track[highlightIndex] : null;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={cn('w-full max-w-[22rem]', className)}
      role="img"
      aria-label="Sky plot of the pass, azimuth around and elevation from the rim to the centre"
    >
      <circle cx={centre} cy={centre} r={radius} fill="#050505" stroke="#3a3a3f" strokeWidth="1" />

      {/* Elevation rings. */}
      {[30, 60].map((elevation) => (
        <g key={elevation}>
          <circle
            cx={centre}
            cy={centre}
            r={radius * (1 - elevation / 90)}
            fill="none"
            stroke="#232326"
            strokeWidth="0.8"
          />
          <text
            x={centre + 3}
            y={centre - radius * (1 - elevation / 90) - 3}
            className="fill-[#86868f] font-mono text-[8px]"
          >
            {elevation}&deg;
          </text>
        </g>
      ))}

      {/* The minimum elevation threshold. */}
      <circle
        cx={centre}
        cy={centre}
        r={radius * (1 - minElevation / 90)}
        fill="none"
        stroke="#e8ac4a"
        strokeOpacity="0.45"
        strokeWidth="0.9"
        strokeDasharray="3 3"
      />

      {/* Azimuth spokes. */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((azimuth) => {
        const [x, y] = project(azimuth, 0);
        return (
          <line
            key={azimuth}
            x1={centre}
            y1={centre}
            x2={x}
            y2={y}
            stroke="#232326"
            strokeWidth="0.7"
          />
        );
      })}

      {/* Horizon obstruction mask. */}
      {maskPath && (
        <path d={maskPath} fill="#f0706f" fillOpacity="0.14" stroke="#f0706f" strokeOpacity="0.4" strokeWidth="0.7" fillRule="evenodd" />
      )}

      {/* Cardinal labels. */}
      {[
        ['N', 0], ['E', 90], ['S', 180], ['W', 270],
      ].map(([label, azimuth]) => {
        const theta = ((azimuth - 90) * Math.PI) / 180;
        const r = radius + 13;
        return (
          <text
            key={label}
            x={centre + r * Math.cos(theta)}
            y={centre + r * Math.sin(theta) + 3.5}
            textAnchor="middle"
            className="fill-[#c4c4cc] text-[10px] font-semibold"
          >
            {label}
          </text>
        );
      })}

      {/* The pass track. */}
      {runs.map((run, i) => (
        <polyline
          key={i}
          points={run.points.map((p) => project(p.azimuth, p.elevation).join(',')).join(' ')}
          fill="none"
          stroke={run.illuminated ? '#e8ac4a' : '#ffffff'}
          strokeWidth={run.illuminated ? 2.2 : 1.6}
          strokeDasharray={run.illuminated ? undefined : '4 3'}
          strokeLinecap="round"
        />
      ))}

      {/* Markers. */}
      {aos && <Marker point={project(aos.azimuth, aos.elevation)} colour="#3fd49b" label="AOS" />}
      {los && <Marker point={project(los.azimuth, los.elevation)} colour="#f0706f" label="LOS" />}
      {tca && <Marker point={project(tca.azimuth, tca.elevation)} colour="#ffffff" label="TCA" filled />}
      {highlighted && (
        <circle
          cx={project(highlighted.azimuth, highlighted.elevation)[0]}
          cy={project(highlighted.azimuth, highlighted.elevation)[1]}
          r="4.5"
          fill="#ffffff"
          stroke="#ffffff"
          strokeWidth="1.2"
        />
      )}

      {showTimes && aos && los && (
        <>
          <text x="6" y={size - 6} className="fill-[#86868f] font-mono text-[8px]">
            AOS {timeShort(aos.t, true)} &middot; {compass(aos.azimuth)} {deg(aos.azimuth, 0)}
          </text>
          <text x={size - 6} y={size - 6} textAnchor="end" className="fill-[#86868f] font-mono text-[8px]">
            LOS {timeShort(los.t, true)} &middot; {compass(los.azimuth)} {deg(los.azimuth, 0)}
          </text>
        </>
      )}
    </svg>
  );
}

function Marker({ point, colour, label, filled }) {
  return (
    <g>
      <circle cx={point[0]} cy={point[1]} r="3.2" fill={filled ? colour : '#000000'} stroke={colour} strokeWidth="1.5" />
      <text
        x={point[0] + 5.5}
        y={point[1] + 3}
        className="font-mono text-[8px]"
        fill={colour}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * The sky as it is right now from one site: every tracked object placed by its
 * azimuth and elevation, with the Sun and Moon for context. Objects below the
 * horizon are not drawn, so the chart is a direct answer to "what can I point
 * at from here".
 */
export function SkyNowChart({
  objects = [],
  sun,
  moon,
  horizonMask,
  minElevation = 10,
  size = 360,
  selectedId,
  onSelect,
  className,
}) {
  const centre = size / 2;
  const radius = centre - 28;

  const project = (azimuth, elevation) => {
    const r = radius * (1 - Math.max(0, Math.min(90, elevation)) / 90);
    const theta = ((azimuth - 90) * Math.PI) / 180;
    return [centre + r * Math.cos(theta), centre + r * Math.sin(theta)];
  };

  const maskPoints = horizonMask
    ? Array.from({ length: 121 }, (_, i) => project(i * 3, maskElevationAt(horizonMask, i * 3)))
    : null;

  const visible = objects.filter((o) => o.elevation !== null && o.elevation >= 0);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={cn('w-full max-w-[26rem]', className)}
      role="img"
      aria-label={`Sky chart showing ${visible.length} objects above the horizon`}
    >
      <circle cx={centre} cy={centre} r={radius} fill="#050505" stroke="#3a3a3f" />

      {[30, 60].map((elevation) => (
        <circle
          key={elevation}
          cx={centre}
          cy={centre}
          r={radius * (1 - elevation / 90)}
          fill="none"
          stroke="#232326"
          strokeWidth="0.8"
        />
      ))}

      <circle
        cx={centre}
        cy={centre}
        r={radius * (1 - minElevation / 90)}
        fill="none"
        stroke="#e8ac4a"
        strokeOpacity="0.4"
        strokeWidth="0.9"
        strokeDasharray="3 3"
      />

      {[0, 45, 90, 135, 180, 225, 270, 315].map((azimuth) => {
        const [x, y] = project(azimuth, 0);
        return <line key={azimuth} x1={centre} y1={centre} x2={x} y2={y} stroke="#232326" strokeWidth="0.7" />;
      })}

      {maskPoints && (
        <polygon
          points={maskPoints.map((p) => p.join(',')).join(' ')}
          fill="#f0706f"
          fillOpacity="0.12"
          stroke="#f0706f"
          strokeOpacity="0.35"
          strokeWidth="0.7"
        />
      )}

      {[['N', 0], ['E', 90], ['S', 180], ['W', 270]].map(([label, azimuth]) => {
        const theta = ((azimuth - 90) * Math.PI) / 180;
        const r = radius + 14;
        return (
          <text
            key={label}
            x={centre + r * Math.cos(theta)}
            y={centre + r * Math.sin(theta) + 3.5}
            textAnchor="middle"
            className="fill-[#c4c4cc] text-[10px] font-semibold"
          >
            {label}
          </text>
        );
      })}

      {sun && sun.elevation > -2 && (
        <g>
          <circle
            cx={project(sun.azimuth, Math.max(0, sun.elevation))[0]}
            cy={project(sun.azimuth, Math.max(0, sun.elevation))[1]}
            r="7"
            fill="#e8ac4a"
            fillOpacity="0.25"
          />
          <circle
            cx={project(sun.azimuth, Math.max(0, sun.elevation))[0]}
            cy={project(sun.azimuth, Math.max(0, sun.elevation))[1]}
            r="3.5"
            fill="#e8ac4a"
          />
        </g>
      )}

      {moon && moon.elevation > 0 && (
        <circle
          cx={project(moon.azimuth, moon.elevation)[0]}
          cy={project(moon.azimuth, moon.elevation)[1]}
          r="4"
          fill="#c4c4cc"
          fillOpacity={0.3 + 0.7 * (moon.illumination ?? 0.5)}
          stroke="#ffffff"
          strokeWidth="0.8"
        />
      )}

      {visible.map((object) => {
        const [x, y] = project(object.azimuth, object.elevation);
        const selected = object.id === selectedId;
        return (
          <g
            key={object.id}
            onClick={() => onSelect?.(object.id)}
            className={onSelect ? 'cursor-pointer' : undefined}
          >
            {selected && <circle cx={x} cy={y} r="8" fill="none" stroke={object.colour ?? '#ffffff'} strokeOpacity="0.5" />}
            <circle
              cx={x}
              cy={y}
              r={selected ? 5 : 3.8}
              fill={object.eclipsed ? '#000000' : object.colour ?? '#ffffff'}
              stroke={object.colour ?? '#ffffff'}
              strokeWidth={object.eclipsed ? 1.5 : 0.8}
            />
            <text x={x + 7} y={y + 3.5} className="fill-[#c4c4cc] text-[9px]">
              {object.name}
            </text>
          </g>
        );
      })}

      {visible.length === 0 && (
        <text x={centre} y={centre} textAnchor="middle" className="fill-[#86868f] text-[10px]">
          Nothing above the horizon
        </text>
      )}
    </svg>
  );
}

/**
 * Horizon mask display and editor.
 *
 * Thirty-six slots, one per ten degrees of azimuth. Dragging a bar sets the
 * obstruction elevation on that bearing, which feeds straight into the fourth
 * visibility clause.
 */
export function HorizonMaskEditor({ mask, onChange, readOnly, className, maxElevation = 30 }) {
  const slots = mask ?? new Array(36).fill(0);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex h-28 items-end gap-[2px]">
        {slots.map((value, i) => {
          const azimuth = i * 10;
          const pct = Math.min(100, (value / maxElevation) * 100);
          return (
            <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
              <div
                className={cn(
                  'w-full rounded-t bg-bad/40 transition-[height]',
                  !readOnly && 'group-hover:bg-bad/60',
                )}
                style={{ height: `${Math.max(pct, value > 0 ? 3 : 0)}%` }}
              />
              {!readOnly && (
                <input
                  type="range"
                  min={0}
                  max={maxElevation}
                  step={0.5}
                  value={value}
                  aria-label={`Obstruction elevation at azimuth ${azimuth} degrees`}
                  onChange={(e) => {
                    const next = [...slots];
                    next[i] = Number(e.target.value);
                    onChange?.(next);
                  }}
                  className="absolute inset-0 h-full w-full cursor-ns-resize appearance-none bg-transparent opacity-0"
                  style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                />
              )}
              <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded border border-line-strong bg-raised px-1 py-0.5 font-mono text-[9px] text-ink group-hover:block">
                {azimuth}&deg; / {value.toFixed(1)}&deg;
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between font-mono text-[9px] text-ink-faint">
        <span>N 0&deg;</span>
        <span>E 90&deg;</span>
        <span>S 180&deg;</span>
        <span>W 270&deg;</span>
        <span>N 360&deg;</span>
      </div>
    </div>
  );
}

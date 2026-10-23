import {
  CheckCircle2, CircleSlash, Eye, EyeOff, Moon, Sun, SunDim, TriangleAlert,
} from 'lucide-react';
import { Badge, Tag } from '../ui/primitives.jsx';
import { Tooltip } from '../ui/overlay.jsx';
import { mag, num } from '../../lib/format.js';

/** Element-set freshness band (SRS A.7). */
export function FreshnessBadge({ freshness, size = 'sm', showAge = true }) {
  if (!freshness) return null;
  const days = freshness.ageDays ?? 0;
  const ageLabel = days < 1 ? `${Math.round(freshness.ageHours)} h` : `${num(days, 1)} d`;
  return (
    <Tooltip
      label={`${freshness.description} Epoch age ${ageLabel}. Positional uncertainty of roughly ${num(
        freshness.estimatedErrorKm,
        1,
      )} km.`}
    >
      <Badge tone={freshness.tone} size={size} dot>
        {freshness.label}
        {showAge && <span className="tnum font-mono opacity-80">{ageLabel}</span>}
      </Badge>
    </Tooltip>
  );
}

/** Pass quality band (SRS A.8). */
export function QualityBadge({ band, score, size = 'sm', degraded }) {
  if (!band) return null;
  return (
    <Tooltip
      label={
        degraded
          ? `Quality ${num(score * 100, 0)} of 100. Scored without the cloud term because no forecast was available, then renormalised.`
          : `Quality ${num(score * 100, 0)} of 100, from maximum elevation, duration, illumination, sky darkness and element-set confidence.`
      }
    >
      <Badge tone={band.tone} size={size}>
        {band.label}
        <span className="tnum font-mono opacity-80">{num(score * 100, 0)}</span>
        {degraded && <TriangleAlert size={10} aria-hidden />}
      </Badge>
    </Tooltip>
  );
}

/** Whether a pass satisfies all four visibility clauses (SRS A.5). */
export function VisibilityBadge({ visibility, size = 'sm' }) {
  if (!visibility) return null;
  if (visibility.visible) {
    return (
      <Tooltip label="All four visibility clauses hold: elevation, illumination, sky darkness and horizon mask.">
        <Badge tone="good" size={size} icon={Eye}>
          Visible
        </Badge>
      </Tooltip>
    );
  }
  return (
    <Tooltip label={`Above the horizon, but not visible. ${visibility.reason}.`}>
      <Badge tone="default" size={size} icon={EyeOff}>
        Above horizon
      </Badge>
    </Tooltip>
  );
}

const ECLIPSE = {
  sunlit: { label: 'Sunlit', tone: 'warn', icon: Sun },
  penumbra: { label: 'Penumbra', tone: 'default', icon: SunDim },
  umbra: { label: 'Eclipsed', tone: 'info', icon: Moon },
};

export function EclipseBadge({ state, size = 'sm' }) {
  const config = ECLIPSE[state] ?? ECLIPSE.umbra;
  return (
    <Tooltip
      label={
        state === 'sunlit'
          ? 'Outside the Earth shadow cone, so it can reflect sunlight.'
          : state === 'penumbra'
            ? 'Inside the penumbra. Partly shadowed and fading.'
            : 'Inside the umbra. Fully shadowed and not reflecting sunlight.'
      }
    >
      <Badge tone={config.tone} size={size} icon={config.icon}>
        {config.label}
      </Badge>
    </Tooltip>
  );
}

export function OrbitBadge({ orbitClass, size = 'sm' }) {
  const tone = { LEO: 'primary', MEO: 'info', GEO: 'warn', HEO: 'default' }[orbitClass] ?? 'default';
  const label = {
    LEO: 'Low Earth orbit',
    MEO: 'Medium Earth orbit',
    GEO: 'Geostationary orbit',
    HEO: 'Highly elliptical orbit',
  }[orbitClass];
  return (
    <Tooltip label={label}>
      <Badge tone={tone} size={size}>
        {orbitClass}
      </Badge>
    </Tooltip>
  );
}

export function StatusBadge({ status, size = 'sm' }) {
  const map = {
    active: { tone: 'good', label: 'Active', icon: CheckCircle2 },
    inactive: { tone: 'default', label: 'Inactive', icon: CircleSlash },
    decayed: { tone: 'bad', label: 'Decayed', icon: CircleSlash },
    suspended: { tone: 'bad', label: 'Suspended', icon: CircleSlash },
    unverified: { tone: 'warn', label: 'Unverified', icon: TriangleAlert },
    nominal: { tone: 'good', label: 'Nominal', icon: CheckCircle2 },
    degraded: { tone: 'warn', label: 'Degraded', icon: TriangleAlert },
    offline: { tone: 'bad', label: 'Offline', icon: CircleSlash },
  };
  const config = map[status] ?? { tone: 'default', label: status };
  return (
    <Badge tone={config.tone} size={size} icon={config.icon}>
      {config.label}
    </Badge>
  );
}

/** Estimated magnitude, always labelled as an estimate (SRS A.6). */
export function MagnitudeBadge({ magnitude, magnitudeClass, size = 'sm' }) {
  if (magnitude === null || magnitude === undefined) {
    return (
      <Tooltip label="Not estimated: the object is in the Earth's shadow for this pass.">
        <Tag>no estimate</Tag>
      </Tooltip>
    );
  }
  return (
    <Tooltip
      label={`Estimated visual magnitude ${mag(magnitude)}, plus or minus about 1.2. A diffuse-sphere model from the standard magnitude, slant range and phase angle. Not a measurement.`}
    >
      <Badge tone={magnitudeClass?.tone ?? 'default'} size={size}>
        <span className="tnum font-mono">{mag(magnitude)}</span>
        <span className="opacity-70">est</span>
      </Badge>
    </Tooltip>
  );
}

export function BandTags({ bands, max = 4 }) {
  if (!bands || bands.length === 0) return <span className="text-ink-faint">&mdash;</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {bands.slice(0, max).map((band) => (
        <Tag key={band}>{band}</Tag>
      ))}
      {bands.length > max && <Tag mono={false}>+{bands.length - max}</Tag>}
    </span>
  );
}

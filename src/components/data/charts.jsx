import { useMemo } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { cn } from '../../lib/cn.js';
import { num, timeShort, dateShort } from '../../lib/format.js';
import { Panel, PanelBody, PanelHeader } from '../ui/panel.jsx';
import { SourceTag } from './source.jsx';

/**
 * Chart theme.
 *
 * One palette, one axis treatment and one tooltip for every chart on the site.
 * The series colours are ordered so the first three stay distinguishable in
 * greyscale as well as in colour.
 */
export const SERIES = {
  primary: '#4d9bff',
  good: '#2fbf8f',
  warn: '#e0a03a',
  bad: '#e8605f',
  info: '#8b7bf0',
  muted: '#6c7a91',
};

export const SERIES_ORDER = [SERIES.primary, SERIES.good, SERIES.warn, SERIES.info, SERIES.bad, SERIES.muted];

const AXIS = {
  stroke: '#27344a',
  tick: { fill: '#6c7a91', fontSize: 10, fontFamily: '"JetBrains Mono", monospace' },
  tickLine: false,
};

const GRID = { stroke: '#1c2636', strokeDasharray: '2 4', vertical: false };

/** Shared tooltip. Values are formatted by the caller so units stay correct. */
export function ChartTooltip({ active, payload, label, formatLabel, formatValue, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line-strong bg-raised/95 px-2.5 py-2 shadow-pop backdrop-blur">
      {label !== undefined && (
        <p className="tnum mb-1 font-mono text-2xs text-ink-faint">
          {formatLabel ? formatLabel(label) : label}
        </p>
      )}
      <div className="space-y-0.5">
        {payload
          .filter((entry) => entry.value !== null && entry.value !== undefined)
          .map((entry) => (
            <p key={entry.dataKey} className="flex items-center gap-2 text-2xs">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: entry.color ?? entry.stroke ?? SERIES.primary }}
                aria-hidden
              />
              <span className="text-ink-faint">{entry.name}</span>
              <span className="tnum ml-auto font-mono text-ink">
                {formatValue ? formatValue(entry.value, entry) : num(entry.value, 2)}
                {unit ? ` ${unit}` : ''}
              </span>
            </p>
          ))}
      </div>
    </div>
  );
}

/** Panel wrapper so every chart gets a title, a source tag and a fixed height. */
export function ChartCard({
  title,
  subtitle,
  meta,
  actions,
  height = 220,
  footer,
  className,
  children,
  bodyClassName,
}) {
  return (
    <Panel className={className}>
      <PanelHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            {actions}
            {meta && <SourceTag meta={meta} compact />}
          </div>
        }
      />
      <PanelBody className={cn('pt-4', bodyClassName)}>
        <div style={{ height }} className="w-full min-w-0">
          {children}
        </div>
        {footer && <div className="mt-3 border-t border-line pt-2.5">{footer}</div>}
      </PanelBody>
    </Panel>
  );
}

const timeTick = (value) => timeShort(value);
const dayTick = (value) => dateShort(value).slice(0, 6);

/**
 * Time-series line or area chart.
 *
 * @param {object} props
 * @param {Array<object>} props.data
 * @param {Array<{key: string, name: string, colour?: string, area?: boolean, dashed?: boolean, axis?: 'left'|'right'}>} props.series
 */
export function TimeSeries({
  data,
  series,
  xKey = 't',
  height = 220,
  formatValue,
  unit,
  domain,
  referenceLines = [],
  referenceAreas = [],
  tickFormat = 'time',
  rightDomain,
  stacked = false,
  showGrid = true,
}) {
  const hasArea = series.some((s) => s.area);
  const Chart = hasArea ? AreaChart : LineChart;
  const hasRight = series.some((s) => s.axis === 'right');

  const gradients = useMemo(
    () =>
      series
        .filter((s) => s.area)
        .map((s) => ({ id: `grad-${s.key}`, colour: s.colour ?? SERIES.primary })),
    [series],
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 6, right: hasRight ? 6 : 10, bottom: 0, left: -12 }}>
        {gradients.length > 0 && (
          <defs>
            {gradients.map((g) => (
              <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={g.colour} stopOpacity={0.3} />
                <stop offset="100%" stopColor={g.colour} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
        )}
        {showGrid && <CartesianGrid {...GRID} />}
        <XAxis
          dataKey={xKey}
          axisLine={{ stroke: AXIS.stroke }}
          tickLine={AXIS.tickLine}
          tick={AXIS.tick}
          tickFormatter={tickFormat === 'time' ? timeTick : tickFormat === 'day' ? dayTick : undefined}
          minTickGap={28}
        />
        <YAxis
          yAxisId="left"
          axisLine={false}
          tickLine={AXIS.tickLine}
          tick={AXIS.tick}
          domain={domain}
          width={48}
        />
        {hasRight && (
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={AXIS.tickLine}
            tick={AXIS.tick}
            domain={rightDomain}
            width={44}
          />
        )}
        <Tooltip
          content={
            <ChartTooltip
              formatLabel={(v) => (tickFormat === 'day' ? dateShort(v) : `${dateShort(v)} ${timeShort(v, true)}`)}
              formatValue={formatValue}
              unit={unit}
            />
          }
          cursor={{ stroke: '#27344a', strokeWidth: 1 }}
        />
        {referenceAreas.map((area) => (
          <ReferenceArea
            key={`${area.y1}-${area.y2}-${area.x1 ?? ''}`}
            yAxisId={area.axis ?? 'left'}
            x1={area.x1}
            x2={area.x2}
            y1={area.y1}
            y2={area.y2}
            fill={area.colour ?? SERIES.warn}
            fillOpacity={area.opacity ?? 0.07}
            stroke="none"
          />
        ))}
        {referenceLines.map((line) => (
          <ReferenceLine
            key={`${line.y ?? line.x}-${line.label ?? ''}`}
            yAxisId={line.axis ?? 'left'}
            y={line.y}
            x={line.x}
            stroke={line.colour ?? SERIES.muted}
            strokeDasharray={line.dashed === false ? undefined : '4 4'}
            strokeWidth={1}
            label={
              line.label
                ? {
                    value: line.label,
                    position: line.position ?? 'insideTopRight',
                    fill: line.colour ?? SERIES.muted,
                    fontSize: 9,
                    fontFamily: '"JetBrains Mono", monospace',
                  }
                : undefined
            }
          />
        ))}
        {series.map((s, i) =>
          s.area ? (
            <Area
              key={s.key}
              yAxisId={s.axis ?? 'left'}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.colour ?? SERIES_ORDER[i % SERIES_ORDER.length]}
              strokeWidth={1.6}
              fill={`url(#grad-${s.key})`}
              dot={false}
              activeDot={{ r: 2.5, strokeWidth: 0 }}
              connectNulls={false}
              stackId={stacked ? 'a' : undefined}
              strokeDasharray={s.dashed ? '4 3' : undefined}
            />
          ) : (
            <Line
              key={s.key}
              yAxisId={s.axis ?? 'left'}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.colour ?? SERIES_ORDER[i % SERIES_ORDER.length]}
              strokeWidth={1.6}
              dot={false}
              activeDot={{ r: 2.5, strokeWidth: 0 }}
              connectNulls={false}
              strokeDasharray={s.dashed ? '4 3' : undefined}
            />
          ),
        )}
      </Chart>
    </ResponsiveContainer>
  );
}

/** Bar chart with per-bar colouring, used for the K index and role breakdowns. */
export function BarSeries({
  data,
  xKey,
  yKey,
  height = 200,
  colourFor,
  formatValue,
  unit,
  domain,
  referenceLines = [],
  tickFormat = 'time',
  name = 'Value',
  barSize,
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -12 }}>
        <CartesianGrid {...GRID} />
        <XAxis
          dataKey={xKey}
          axisLine={{ stroke: AXIS.stroke }}
          tickLine={AXIS.tickLine}
          tick={AXIS.tick}
          tickFormatter={tickFormat === 'time' ? timeTick : tickFormat === 'day' ? dayTick : undefined}
          minTickGap={24}
        />
        <YAxis axisLine={false} tickLine={AXIS.tickLine} tick={AXIS.tick} domain={domain} width={44} />
        <Tooltip
          content={
            <ChartTooltip
              formatLabel={(v) =>
                tickFormat === 'none' ? v : tickFormat === 'day' ? dateShort(v) : `${dateShort(v)} ${timeShort(v)}`
              }
              formatValue={formatValue}
              unit={unit}
            />
          }
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        {referenceLines.map((line) => (
          <ReferenceLine
            key={line.y}
            y={line.y}
            stroke={line.colour ?? SERIES.warn}
            strokeDasharray="4 4"
            strokeWidth={1}
            label={{
              value: line.label,
              position: 'insideTopRight',
              fill: line.colour ?? SERIES.warn,
              fontSize: 9,
              fontFamily: '"JetBrains Mono", monospace',
            }}
          />
        ))}
        <Bar dataKey={yKey} name={name} radius={[2, 2, 0, 0]} barSize={barSize}>
          {data.map((row, i) => (
            <Cell key={i} fill={colourFor ? colourFor(row) : SERIES.primary} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Tiny inline trend line, for table cells and stat tiles. */
export function Sparkline({ data, dataKey = 'value', colour = SERIES.primary, height = 28, width = 96, area = true }) {
  if (!data || data.length < 2) return <span className="text-2xs text-ink-faint">&mdash;</span>;
  const id = `spark-${dataKey}-${Math.round(Math.random() * 1e6)}`;
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colour} stopOpacity={0.35} />
              <stop offset="100%" stopColor={colour} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={colour}
            strokeWidth={1.3}
            fill={area ? `url(#${id})` : 'none'}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal ranked bars, for "most watched" style lists. */
export function RankedBars({ rows, valueKey = 'value', labelKey = 'label', formatValue, className }) {
  const max = Math.max(...rows.map((r) => r[valueKey]), 1);
  return (
    <ul className={cn('space-y-2', className)}>
      {rows.map((row) => (
        <li key={row[labelKey]} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-ink-dim">{row[labelKey]}</span>
            <span className="tnum shrink-0 font-mono text-ink">
              {formatValue ? formatValue(row[valueKey]) : num(row[valueKey])}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-overlay">
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: `${(row[valueKey] / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

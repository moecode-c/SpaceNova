import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Activity, History, Ruler, Satellite, TrendingUp } from 'lucide-react';
import { Grid, KeyValue, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, Section, StatTile } from '../../components/ui/panel.jsx';
import { DataTable } from '../../components/ui/table.jsx';
import { SearchInput } from '../../components/ui/form.jsx';
import { Tag } from '../../components/ui/primitives.jsx';
import { EmptyState, InlineNote, LoadingState } from '../../components/ui/feedback.jsx';
import { ChartCard, SERIES, TimeSeries } from '../../components/data/charts.jsx';
import { ComputedNotice, SourceTag } from '../../components/data/source.jsx';
import { FreshnessBadge, OrbitBadge } from '../../components/data/badges.jsx';
import { useApi, useDebounced } from '../../hooks/useApi.js';
import { catalog, engineering } from '../../api/index.js';
import { dateTime, km, num } from '../../lib/format.js';

export default function ElementSets() {
  const { objectId } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);

  const suggestions = useApi(() => catalog.suggest(debounced || 'a', 14), [debounced]);
  const diagnostics = useApi(() => engineering.diagnostics(objectId), [objectId], {
    enabled: !!objectId,
  });

  const data = diagnostics.data;

  const residualSeries = (data?.residuals ?? [])
    .map((r) => ({
      ageHours: Math.round(r.epochAgeHours),
      positionErrorKm: r.positionErrorKm,
      predictedBandKm: r.predictedBandKm,
      groundErrorKm: r.groundErrorKm,
    }))
    .sort((a, b) => a.ageHours - b.ageHours);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={History}
        title="Element sets and staleness diagnostics"
        description="How far a prediction drifts as the epoch ages. Each older element set is propagated to the same instant and compared with the newest one."
        meta={
          <>
            {data && <Tag mono={false}>{data.object.name}</Tag>}
            {diagnostics.meta && <SourceTag meta={diagnostics.meta} />}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Panel>
          <PanelHeader title="Choose an object" icon={Satellite} />
          <PanelBody className="space-y-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Name or catalogue number" />
            <ul className="max-h-[32rem] space-y-1 overflow-y-auto">
              {(suggestions.data ?? []).map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/app/engineering/element-sets/${row.id}`)}
                    className={
                      row.id === objectId
                        ? 'flex w-full items-center justify-between gap-2 rounded-md border border-primary-dim bg-primary-soft/40 px-2.5 py-2 text-left'
                        : 'flex w-full items-center justify-between gap-2 rounded-md border border-line bg-base/40 px-2.5 py-2 text-left transition-colors hover:border-line-strong'
                    }
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs text-ink">{row.name}</p>
                      <p className="tnum truncate font-mono text-2xs text-ink-faint">{row.noradId}</p>
                    </div>
                    <OrbitBadge orbitClass={row.orbitClass} />
                  </button>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>

        <div className="space-y-3">
          {!objectId ? (
            <Panel>
              <EmptyState
                icon={History}
                title="No object selected"
                description="Pick one from the list to see its element-set history and the residuals between sets."
              />
            </Panel>
          ) : diagnostics.loading && !data ? (
            <Panel>
              <LoadingState label="Propagating every set to the same instant" />
            </Panel>
          ) : data ? (
            <>
              <Grid cols={4}>
                <StatTile
                  label="Sets held"
                  value={num(data.sets.length)}
                  hint="Newest first"
                  icon={History}
                />
                <StatTile
                  label="Current band"
                  value={data.sets[0].freshness.label}
                  tone={data.sets[0].freshness.tone}
                  hint={`Epoch age ${num(data.sets[0].freshness.ageHours, 1)} h`}
                />
                <StatTile
                  label="Largest residual"
                  value={
                    residualSeries.length
                      ? km(Math.max(...residualSeries.map((r) => r.positionErrorKm ?? 0)), 1)
                      : '--'
                  }
                  hint="Oldest set against the newest"
                  icon={Ruler}
                />
                <StatTile
                  label="Uncertainty band now"
                  value={`±${num(data.sets[0].freshness.estimatedErrorKm, 1)} km`}
                  hint="From the epoch age model"
                  icon={TrendingUp}
                />
              </Grid>

              <ComputedNotice>{data.note}</ComputedNotice>

              {residualSeries.length > 1 && (
                <ChartCard
                  title="Residual against the newest element set"
                  subtitle="Position difference at the same instant, plotted against the epoch age of the older set."
                  meta={diagnostics.meta}
                  height={220}
                  footer={
                    <InlineNote icon={Activity}>
                      The dashed line is the uncertainty band the freshness model predicts from the
                      epoch age alone. Where the measured residual runs above it, the object is
                      losing altitude faster than the model assumes, which is the signature of a
                      low perigee or a geomagnetic storm.
                    </InlineNote>
                  }
                >
                  <TimeSeries
                    height={220}
                    xKey="ageHours"
                    tickFormat="none"
                    data={residualSeries}
                    series={[
                      { key: 'positionErrorKm', name: 'Measured residual (km)', colour: SERIES.primary, area: true },
                      { key: 'predictedBandKm', name: 'Predicted band (km)', colour: SERIES.warn, dashed: true },
                    ]}
                    formatValue={(v) => km(v, 2)}
                  />
                </ChartCard>
              )}

              <Section title="Element set history">
                <Panel>
                  <DataTable
                    rowKey={(s) => s.id}
                    columns={[
                      { key: 'epoch', header: 'Epoch (UTC)', mono: true, render: (s) => dateTime(s.epoch, true) },
                      { key: 'freshness', header: 'Band', render: (s) => <FreshnessBadge freshness={s.freshness} /> },
                      { key: 'meanMotion', header: 'Mean motion', align: 'right', mono: true, render: (s) => num(s.meanMotion, 8) },
                      {
                        key: 'deltaN',
                        header: 'Change',
                        align: 'right',
                        mono: true,
                        hideBelow: 'md',
                        render: (s) =>
                          s.delta ? (
                            <span className={s.delta.meanMotion > 0 ? 'text-warn' : 'text-ink-dim'}>
                              {s.delta.meanMotion > 0 ? '+' : ''}
                              {s.delta.meanMotion.toExponential(2)}
                            </span>
                          ) : (
                            <span className="text-ink-faint">&mdash;</span>
                          ),
                      },
                      { key: 'perigeeKm', header: 'Perigee', align: 'right', mono: true, render: (s) => km(s.perigeeKm, 1) },
                      { key: 'apogeeKm', header: 'Apogee', align: 'right', mono: true, hideBelow: 'lg', render: (s) => km(s.apogeeKm, 1) },
                      { key: 'bstar', header: 'B*', align: 'right', mono: true, hideBelow: 'lg', render: (s) => s.bstar.toExponential(3) },
                      { key: 'raan', header: 'RAAN', align: 'right', mono: true, hideBelow: 'xl', render: (s) => num(s.raan, 3) },
                      { key: 'elsetNumber', header: 'Set', align: 'right', mono: true, hideBelow: 'xl' },
                    ]}
                    rows={data.sets}
                  />
                </Panel>
              </Section>

              <Panel>
                <PanelHeader title="Current set, in full" icon={Satellite} />
                <PanelBody className="space-y-3">
                  <pre className="overflow-x-auto rounded-md border border-line bg-void px-3 py-2.5 font-code text-[0.68rem] leading-relaxed text-ink-dim">
                    {data.sets[0].line1}
                    {'\n'}
                    {data.sets[0].line2}
                  </pre>
                  <KeyValue
                    columns={3}
                    dense
                    rows={[
                      { label: 'Inclination', value: num(data.sets[0].inclination, 4) },
                      { label: 'RAAN', value: num(data.sets[0].raan, 4) },
                      { label: 'Eccentricity', value: num(data.sets[0].eccentricity, 7) },
                      { label: 'Argument of perigee', value: num(data.sets[0].argPerigee, 4) },
                      { label: 'Mean anomaly', value: num(data.sets[0].meanAnomaly, 4) },
                      { label: 'Mean motion', value: num(data.sets[0].meanMotion, 8) },
                      { label: 'Semi-major axis', value: km(data.sets[0].semiMajorAxisKm, 1) },
                      { label: 'Period', value: `${num(data.sets[0].periodMinutes, 2)} min` },
                      { label: 'Revolution number', value: num(data.sets[0].revNumber) },
                    ]}
                  />
                </PanelBody>
                <PanelFooter>
                  <InlineNote>
                    These element sets are Phase 1 fixtures generated locally. In Phase 2 the same
                    screen reads general perturbation data from the providers in the specification,
                    and the residuals become a genuine comparison between successive issues.
                  </InlineNote>
                </PanelFooter>
              </Panel>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, CalendarRange, Cloud, Eye, Filter, Play, Plus, Save,
  SlidersHorizontal, Timer, X,
} from 'lucide-react';
import { Grid, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, Section, StatTile } from '../../components/ui/panel.jsx';
import { DataTable } from '../../components/ui/table.jsx';
import { Checkbox, Field, FormError, Input, SearchInput, Select, Slider, Textarea } from '../../components/ui/form.jsx';
import { Badge, Button, Tag } from '../../components/ui/primitives.jsx';
import { Banner, EmptyState, InlineNote, LoadingState, useToast } from '../../components/ui/feedback.jsx';
import { Drawer, Modal } from '../../components/ui/overlay.jsx';
import { ChartCard, SERIES, TimeSeries } from '../../components/data/charts.jsx';
import { DegradedBanner, SourceTag } from '../../components/data/source.jsx';
import {
  EclipseBadge, FreshnessBadge, MagnitudeBadge, QualityBadge, VisibilityBadge,
} from '../../components/data/badges.jsx';
import { useApi, useAction, useDebounced } from '../../hooks/useApi.js';
import { catalog, passes as passesApi, plans as plansApi } from '../../api/index.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { age, compass, dateShort, deg, duration, num, percent, timeShort } from '../../lib/format.js';

const SPANS = [
  { value: 24, label: 'Tonight, 24 hours' },
  { value: 48, label: '2 days' },
  { value: 72, label: '3 days' },
  { value: 168, label: '7 days' },
];

export default function Planner() {
  const navigate = useNavigate();
  const toast = useToast();
  const { locations, activeLocation, setActiveLocationId } = useSettings();

  const savedPlans = useApi(() => plansApi.list(), []);

  /*
   * The scan runs over a set of objects chosen here. There is no watchlist in
   * between any more, so the selection starts from the most recent saved plan
   * and is edited directly.
   */
  const [selectedObjects, setSelectedObjects] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [objectQuery, setObjectQuery] = useState('');
  const [hours, setHours] = useState(48);
  const [visibleOnly, setVisibleOnly] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [minElevation, setMinElevation] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planNotes, setPlanNotes] = useState('');

  useEffect(() => {
    if (selectedObjects !== null) return;
    const rows = savedPlans.data;
    if (!rows) return;
    const seed = rows.find((p) => p.status === 'active') ?? rows[0];
    setSelectedObjects(seed?.objectIds ?? []);
  }, [savedPlans.data, selectedObjects]);

  const objectIds = useMemo(() => selectedObjects ?? [], [selectedObjects]);

  const debouncedObjectQuery = useDebounced(objectQuery, 250);
  const objectSuggestions = useApi(
    () => catalog.suggest(debouncedObjectQuery, 24),
    [debouncedObjectQuery],
    { enabled: pickerOpen },
  );
  const chosen = useApi(() => catalog.byIds(objectIds), [objectIds.join(',')], {
    enabled: objectIds.length > 0,
  });

  const toggleObject = (id) =>
    setSelectedObjects((current) => {
      const base = current ?? [];
      return base.includes(id) ? base.filter((v) => v !== id) : [...base, id];
    });

  const effectiveMinElevation = minElevation ?? activeLocation?.minElevationDeg ?? 10;

  const prediction = useApi(
    () =>
      passesApi.predict({
        objectIds,
        locationId: activeLocation?.id,
        hours,
        visibleOnly,
        minScore,
        thresholds: { minElevationDeg: effectiveMinElevation },
      }),
    [objectIds.join(','), activeLocation?.id, hours, visibleOnly, minScore, effectiveMinElevation],
    { enabled: objectIds.length > 0 && !!activeLocation },
  );

  const cloud = useApi(() => passesApi.cloudForecast(activeLocation?.id), [activeLocation?.id], {
    enabled: !!activeLocation,
  });

  const save = useAction(
    () =>
      plansApi.create({
        name: planName,
        locationId: activeLocation.id,
        objectIds,
        spanDays: Math.max(1, Math.round(hours / 24)),
        minScore,
        visibleOnly,
        notes: planNotes,
      }),
    {
      onSuccess: (plan) => {
        setSaveOpen(false);
        setPlanName('');
        setPlanNotes('');
        toast.success('Plan saved', 'It is listed below and keeps the thresholds you set.');
        savedPlans.refetch();
        navigate(`/app/planner/${plan.id}`);
      },
    },
  );

  const rows = prediction.data?.passes ?? [];
  const counts = prediction.data?.counts;

  // Group by local night so a seven-day plan reads as a set of sessions.
  const nights = useMemo(() => {
    const map = new Map();
    for (const pass of rows) {
      const d = new Date(pass.aos);
      // A window before 06:00 belongs to the previous evening's session.
      const shifted = new Date(d.getTime() - 6 * 3600000);
      const key = shifted.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(pass);
    }
    return [...map.entries()];
  }, [rows]);

  const cloudPoints = useMemo(
    () =>
      (cloud.data?.points ?? []).map((p) => ({
        t: p.t,
        cover: p.available ? p.cover * 100 : null,
      })),
    [cloud.data],
  );

  if (!activeLocation) {
    return (
      <Panel>
        <EmptyState
          icon={CalendarRange}
          title="No observer location"
          description="A plan is always for one site. Add an observer location to continue."
          action={
            <Link to="/app/locations">
              <Button size="sm" variant="primary">
                Add a location
              </Button>
            </Link>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={CalendarRange}
        title="Observation planner"
        description="Scan the horizon for every object you choose, refine each crossing to the second, apply the visibility clauses and rank what is left."
        meta={
          <>
            <Tag>{objectIds.length} objects</Tag>
            <Tag>{hours} hour window</Tag>
            <Tag>min elevation {effectiveMinElevation}&deg;</Tag>
            {prediction.meta && <SourceTag meta={prediction.meta} />}
          </>
        }
        actions={
          <Button size="sm" variant="primary" icon={Save} onClick={() => setSaveOpen(true)} disabled={objectIds.length === 0}>
            Save as a plan
          </Button>
        }
      />

      <DegradedBanner meta={prediction.meta} />

      {/* --------------------------------------------------------- controls */}
      <Panel>
        <PanelHeader title="Parameters" icon={SlidersHorizontal} />
        <PanelBody className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Field label="Observer location" htmlFor="location">
            <Select id="location" value={activeLocation.id} onChange={(e) => setActiveLocationId(e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Window" htmlFor="hours">
            <Select id="hours" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {SPANS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>

          <Slider
            label="Minimum elevation"
            min={0}
            max={40}
            step={1}
            value={effectiveMinElevation}
            onChange={setMinElevation}
            display={`${effectiveMinElevation}°`}
          />

          <Slider
            label="Minimum quality"
            min={0}
            max={0.9}
            step={0.05}
            value={minScore}
            onChange={setMinScore}
            display={minScore === 0 ? 'any' : num(minScore * 100, 0)}
          />

          <div className="lg:col-span-2">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="text-xs font-medium text-ink-dim">Objects to scan</p>
              <Button size="xs" variant="outline" icon={Plus} onClick={() => setPickerOpen(true)}>
                Choose objects
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(chosen.data ?? []).map((object) => (
                <button
                  key={object.id}
                  type="button"
                  onClick={() => toggleObject(object.id)}
                  aria-label={`Remove ${object.name} from the scan`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary-dim bg-primary-soft/60 px-2.5 py-1 text-2xs text-primary-bright transition-colors hover:border-bad/50"
                >
                  {object.name}
                  <X size={11} aria-hidden />
                </button>
              ))}
              {objectIds.length === 0 && (
                <p className="text-2xs text-ink-faint">
                  Nothing selected. Choose objects, or load them from a saved plan.
                </p>
              )}
              {objectIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedObjects([])}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line px-2.5 py-1 text-2xs text-ink-faint transition-colors hover:border-line-strong hover:text-ink-dim"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2.5 lg:col-span-2">
            <Checkbox
              checked={visibleOnly}
              onChange={setVisibleOnly}
              label="Only windows that satisfy every visibility clause"
              description="Otherwise anything above the horizon is listed, with the clause that failed."
            />
            <InlineNote>
              Lowering the minimum elevation finds more windows but they are shorter, lower and
              more likely to be blocked by your horizon mask.
            </InlineNote>
          </div>
        </PanelBody>
        <PanelFooter>
          <Button size="sm" variant="secondary" icon={Play} loading={prediction.loading} onClick={() => prediction.reload()}>
            Re-run the scan
          </Button>
          <span className="text-2xs text-ink-faint">
            Coarse step {prediction.meta?.thresholds?.coarseStepSeconds ?? 30} s, refined to{' '}
            {prediction.meta?.thresholds?.refineToleranceSeconds ?? 1} s by bisection.
          </span>
        </PanelFooter>
      </Panel>

      {/* ---------------------------------------------------------- results */}
      {objectIds.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Filter}
            title="No objects selected"
            description="Choose the objects to scan for above."
          />
        </Panel>
      ) : (
        <>
          <Grid cols={4}>
            <StatTile
              label="Windows found"
              value={num(counts?.total ?? 0)}
              hint="Horizon crossings above the threshold"
              icon={Timer}
            />
            <StatTile
              label="Fully visible"
              value={num(counts?.visible ?? 0)}
              tone={counts?.visible ? 'good' : 'default'}
              hint="All four clauses satisfied"
              icon={Eye}
            />
            <StatTile
              label="Shown after filters"
              value={num(counts?.shown ?? 0)}
              hint={visibleOnly ? 'Visible only' : `Quality at or above ${num(minScore * 100, 0)}`}
            />
            <StatTile
              label="Best quality"
              value={rows.length ? num(Math.max(...rows.map((r) => r.score)) * 100, 0) : '--'}
              hint={rows.length ? rows.reduce((b, r) => (r.score > b.score ? r : b), rows[0]).objectName : 'Nothing found'}
              tone="primary"
            />
          </Grid>

          {cloudPoints.length > 0 && (
            <ChartCard
              title="Cloud cover forecast"
              subtitle="At the observer location. The score drops the cloud term where the provider has no forecast, and renormalises the rest."
              meta={cloud.meta}
              height={170}
              footer={
                cloud.data?.horizonAt && (
                  <InlineNote icon={Cloud}>
                    The provider horizon is {dateShort(cloud.data.horizonAt)}. Windows after that are
                    scored without a cloud term and are not directly comparable with earlier ones.
                  </InlineNote>
                )
              }
            >
              <TimeSeries
                height={170}
                data={cloudPoints}
                series={[{ key: 'cover', name: 'Cloud cover (%)', colour: SERIES.info, area: true }]}
                domain={[0, 100]}
                formatValue={(v) => `${num(v, 0)}%`}
                referenceLines={[{ y: 60, label: 'score penalty', colour: SERIES.warn }]}
              />
            </ChartCard>
          )}

          {prediction.data?.refused?.length > 0 && (
            <Banner tone="warn" title="Some objects were refused">
              {prediction.data.refused.length} object
              {prediction.data.refused.length === 1 ? ' was' : 's were'} not propagated:{' '}
              {prediction.data.refused.map((r) => r.objectName).join(', ')}. Their element sets are
              beyond the propagation horizon, so the engine refuses rather than extrapolating.
            </Banner>
          )}

          {prediction.loading && rows.length === 0 ? (
            <Panel>
              <LoadingState label="Scanning the horizon and refining crossings" />
            </Panel>
          ) : nights.length === 0 ? (
            <Panel>
              <EmptyState
                icon={CalendarRange}
                title="No windows match"
                description="Widen the window, lower the minimum elevation, or turn off the visible-only filter."
              />
            </Panel>
          ) : (
            <Section
              title="Ranked windows"
              description="Grouped by session. A session runs from one afternoon to the following morning."
            >
              <div className="space-y-3">
                {nights.map(([key, group]) => {
                  const best = group.reduce((b, r) => (r.score > b.score ? r : b), group[0]);
                  const visibleCount = group.filter((p) => p.visibility.visible).length;
                  return (
                    <Panel key={key}>
                      <PanelHeader
                        title={new Date(`${key}T12:00:00Z`).toLocaleDateString('en-GB', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          timeZone: 'UTC',
                        })}
                        subtitle={`${group.length} windows, ${visibleCount} fully visible. Best is ${best.objectName} at ${timeShort(best.aos)} UTC.`}
                        actions={<QualityBadge band={best.scoreBand} score={best.score} degraded={best.scoreDegraded} />}
                      />
                      <DataTable
                        dense
                        rowKey={(p) => p.id}
                        onRowClick={(p) => navigate(`/app/pass/${p.objectId}?aos=${encodeURIComponent(p.aos)}`)}
                        columns={[
                          {
                            key: 'aos',
                            header: 'Window (UTC)',
                            render: (p) => (
                              <div>
                                <p className="tnum font-mono text-ink">
                                  {timeShort(p.aos, true)} &rarr; {timeShort(p.los, true)}
                                </p>
                                <p className="text-2xs text-ink-faint">{age(p.aos)}</p>
                              </div>
                            ),
                          },
                          {
                            key: 'objectName',
                            header: 'Object',
                            nowrap: false,
                            render: (p) => (
                              <div className="min-w-0">
                                <p className="truncate text-ink">{p.objectName}</p>
                                <p className="truncate text-2xs text-ink-faint">{p.objectCategoryLabel}</p>
                              </div>
                            ),
                          },
                          {
                            key: 'maxElevation',
                            header: 'Max el.',
                            align: 'right',
                            mono: true,
                            render: (p) => deg(p.maxElevation, 1),
                          },
                          {
                            key: 'durationSeconds',
                            header: 'Duration',
                            align: 'right',
                            mono: true,
                            render: (p) => duration(p.durationSeconds),
                          },
                          {
                            key: 'path',
                            header: 'Path',
                            hideBelow: 'lg',
                            render: (p) => (
                              <span className="tnum font-mono text-2xs">
                                {compass(p.azimuthAos)} &rarr; {compass(p.azimuthTca)} &rarr; {compass(p.azimuthLos)}
                              </span>
                            ),
                          },
                          {
                            key: 'magnitude',
                            header: 'Magnitude',
                            hideBelow: 'md',
                            render: (p) => <MagnitudeBadge magnitude={p.magnitude} magnitudeClass={p.magnitudeClass} />,
                          },
                          {
                            key: 'cloud',
                            header: 'Cloud',
                            align: 'right',
                            mono: true,
                            hideBelow: 'xl',
                            render: (p) =>
                              p.cloudCover === null ? (
                                <span className="text-ink-faint">no forecast</span>
                              ) : (
                                <span className={p.cloudCover > 0.6 ? 'text-warn' : undefined}>
                                  {percent(p.cloudCover)}
                                </span>
                              ),
                          },
                          {
                            key: 'eclipse',
                            header: 'Light',
                            hideBelow: 'xl',
                            render: (p) => <EclipseBadge state={p.eclipseState} />,
                          },
                          {
                            key: 'visibility',
                            header: 'Visibility',
                            render: (p) => (
                              <div className="space-y-0.5">
                                <VisibilityBadge visibility={p.visibility} />
                                {!p.visibility.visible && (
                                  <p className="text-2xs text-ink-faint">{p.visibility.reason}</p>
                                )}
                              </div>
                            ),
                          },
                          {
                            key: 'score',
                            header: 'Quality',
                            align: 'right',
                            render: (p) => <QualityBadge band={p.scoreBand} score={p.score} degraded={p.scoreDegraded} />,
                          },
                        ]}
                        rows={group}
                      />
                    </Panel>
                  );
                })}
              </div>
            </Section>
          )}
        </>
      )}

      {/* ------------------------------------------------------- saved plans */}
      <Section
        title="Saved plans"
        description="A plan stores the site, the objects and the thresholds, so the same scan can be re-run later and compared."
      >
        <Panel>
          <DataTable
            loading={savedPlans.loading}
            rowKey={(p) => p.id}
            onRowClick={(p) => navigate(`/app/planner/${p.id}`)}
            columns={[
              {
                key: 'name',
                header: 'Plan',
                nowrap: false,
                render: (p) => (
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{p.name}</p>
                    <p className="truncate text-2xs text-ink-faint">{p.notes}</p>
                  </div>
                ),
              },
              { key: 'locationName', header: 'Site', hideBelow: 'md' },
              {
                key: 'startsAt',
                header: 'Range',
                mono: true,
                render: (p) => `${dateShort(p.startsAt)} + ${p.spanDays}d`,
              },
              {
                key: 'minScore',
                header: 'Filters',
                hideBelow: 'lg',
                render: (p) => (
                  <span className="flex flex-wrap gap-1">
                    {p.visibleOnly && <Tag mono={false}>visible only</Tag>}
                    {p.minScore > 0 && <Tag>q &ge; {num(p.minScore * 100, 0)}</Tag>}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (p) => (
                  <Badge tone={p.status === 'active' ? 'good' : 'default'} size="sm">
                    {p.status}
                  </Badge>
                ),
              },
              {
                key: 'open',
                header: '',
                align: 'right',
                render: () => <ArrowRight size={13} className="text-ink-faint" aria-hidden />,
              },
            ]}
            rows={savedPlans.data ?? []}
            empty={
              <EmptyState
                compact
                icon={Save}
                title="No saved plans"
                description="Set the parameters above and save the scan to keep it."
              />
            }
          />
        </Panel>
      </Section>

      {/* ------------------------------------------------------ object picker */}
      <Drawer
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Choose objects to scan"
        description="Take the objects from a saved plan, or search the whole catalogue."
        width="w-[30rem]"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setSelectedObjects([])}>
              Clear all
            </Button>
            <Button size="sm" variant="primary" onClick={() => setPickerOpen(false)}>
              Done, {objectIds.length} selected
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {(savedPlans.data ?? []).length > 0 && (
            <section className="space-y-2.5">
              <p className="label-caps">From a saved plan</p>
              {(savedPlans.data ?? []).map((plan) => {
                const planObjects = plan.objectIds ?? [];
                const allSelected =
                  planObjects.length > 0 && planObjects.every((id) => objectIds.includes(id));
                return (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-line bg-base/50 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs text-ink">{plan.name}</p>
                      <p className="text-2xs text-ink-faint">
                        {planObjects.length} object{planObjects.length === 1 ? '' : 's'} &middot;{' '}
                        {plan.locationName}
                      </p>
                    </div>
                    <Button
                      size="xs"
                      variant={allSelected ? 'ghost' : 'outline'}
                      disabled={planObjects.length === 0}
                      onClick={() =>
                        setSelectedObjects((current) => {
                          const set = new Set(current ?? []);
                          if (allSelected) planObjects.forEach((id) => set.delete(id));
                          else planObjects.forEach((id) => set.add(id));
                          return [...set];
                        })
                      }
                    >
                      {allSelected ? 'Remove' : 'Add all'}
                    </Button>
                  </div>
                );
              })}
            </section>
          )}

          <section className="space-y-2.5">
            <p className="label-caps">Search the catalogue</p>
            <SearchInput
              value={objectQuery}
              onChange={setObjectQuery}
              placeholder="Name or catalogue number"
              autoFocus
            />
            <ul className="space-y-1">
              {(objectSuggestions.data ?? []).map((row) => {
                const selected = objectIds.includes(row.id);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => toggleObject(row.id)}
                      className={
                        selected
                          ? 'flex w-full items-center justify-between gap-3 rounded-md border border-primary-dim bg-primary-soft/40 px-3 py-2 text-left'
                          : 'flex w-full items-center justify-between gap-3 rounded-md border border-line bg-base/40 px-3 py-2 text-left transition-colors hover:border-line-strong'
                      }
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs text-ink">{row.name}</p>
                        <p className="truncate text-2xs text-ink-faint">
                          {row.categoryLabel} &middot; {row.noradId}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <OrbitBadge orbitClass={row.orbitClass} />
                        {selected ? (
                          <X size={13} className="text-ink-faint" aria-hidden />
                        ) : (
                          <Plus size={13} className="text-ink-faint" aria-hidden />
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
              {objectSuggestions.loading && (
                <li className="py-3 text-center text-2xs text-ink-faint">Searching</li>
              )}
            </ul>
          </section>

          <Banner tone="info" compact title="How many is sensible">
            Every object is scanned across the whole window and each crossing is refined by
            bisection, so the scan time grows with the selection. A few dozen is comfortable.
          </Banner>
        </div>
      </Drawer>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save this scan as a plan"
        description="The site, the objects and the thresholds are stored with it."
        size="sm"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" loading={save.pending} onClick={() => save.run()}>
              Save plan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {save.error && save.error.code !== 'validation' && <FormError error={save.error} />}
          <Field label="Plan name" htmlFor="planName" error={save.fieldErrors?.name} required>
            <Input
              id="planName"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="Tonight from the rooftop"
            />
          </Field>
          <Field label="Notes" htmlFor="planNotes" hint="What you intend to do, and anything to remember on the night.">
            <Textarea id="planNotes" rows={3} value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} />
          </Field>
          <div className="panel-inset space-y-1.5 p-3 text-2xs text-ink-faint">
            <p>Site: <span className="text-ink-dim">{activeLocation.name}</span></p>
            <p>Objects: <span className="text-ink-dim">{objectIds.length}</span> selected</p>
            <p>Window: <span className="text-ink-dim">{hours} hours</span>, minimum elevation {effectiveMinElevation}&deg;</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

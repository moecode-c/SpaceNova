import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight, CalendarRange, CircleAlert, Clock, Eye, MapPin, Trash2,
} from 'lucide-react';
import { Grid, KeyValue, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, Section, StatTile } from '../../components/ui/panel.jsx';
import { Breadcrumbs } from '../../components/ui/nav.jsx';
import { DataTable } from '../../components/ui/table.jsx';
import { Badge, Button, Tag } from '../../components/ui/primitives.jsx';
import { Banner, EmptyState, ErrorState, InlineNote, LoadingState, useToast } from '../../components/ui/feedback.jsx';
import { DegradedBanner, SourceTag } from '../../components/data/source.jsx';
import {
  EclipseBadge, MagnitudeBadge, QualityBadge, VisibilityBadge,
} from '../../components/data/badges.jsx';
import { useApi, useAction } from '../../hooks/useApi.js';
import { passes as passesApi, plans as plansApi } from '../../api/index.js';
import { age, compass, dateShort, deg, duration, num, percent, timeShort } from '../../lib/format.js';

export default function PlanDetail() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const { data, meta, loading, error, reload } = useApi(() => passesApi.plan(planId), [planId]);

  const remove = useAction(() => plansApi.remove(planId), {
    onSuccess: () => {
      toast.success('Plan deleted');
      navigate('/app/planner');
    },
  });

  const timeline = useMemo(() => {
    const windows = data?.windows ?? [];
    if (windows.length === 0) return null;
    const start = new Date(windows[0].aos).getTime();
    const end = new Date(windows.at(-1).los).getTime();
    const span = Math.max(1, end - start);
    return { start, end, span, windows };
  }, [data]);

  if (loading && !data) return <LoadingState label="Running the plan" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const { plan, windows, conflicts, refused, counts } = data;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={CalendarRange}
        title={plan.name}
        breadcrumb={
          <Breadcrumbs
            items={[
              { label: 'Planner', to: '/app/planner' },
              { label: plan.name },
            ]}
          />
        }
        description={plan.notes}
        meta={
          <>
            <Badge tone={plan.status === 'active' ? 'good' : 'default'} dot>
              {plan.status}
            </Badge>
            <Tag>{plan.locationName}</Tag>
            <Tag>{plan.spanDays} day window</Tag>
            {plan.visibleOnly && <Tag mono={false}>visible only</Tag>}
            {meta && <SourceTag meta={meta} />}
          </>
        }
        actions={
          <>
            <Link to="/app/planner">
              <Button size="sm" variant="secondary">
                Adjust parameters
              </Button>
            </Link>
            <Button size="sm" variant="danger" icon={Trash2} loading={remove.pending} onClick={() => remove.run()}>
              Delete
            </Button>
          </>
        }
      />

      <DegradedBanner meta={meta} />

      <Grid cols={5}>
        <StatTile label="Windows kept" value={num(counts.kept)} tone="good" hint="After conflict resolution" icon={Eye} />
        <StatTile label="Displaced" value={num(counts.dropped)} tone={counts.dropped ? 'warn' : 'default'} hint="Overlapping a higher-scoring window" icon={CircleAlert} />
        <StatTile label="Fully visible" value={num(counts.visible)} hint={`${num(counts.total)} horizon crossings in total`} />
        <StatTile
          label="Observing time"
          value={duration(windows.reduce((n, w) => n + w.durationSeconds, 0))}
          hint="Sum of the kept windows"
          icon={Clock}
        />
        <StatTile
          label="Turnaround gap"
          value={`${meta?.turnaroundMinutes ?? 2} min`}
          hint="Minimum spacing between consecutive windows"
        />
      </Grid>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]">
        <Panel>
          <PanelHeader title="Plan record" icon={MapPin} />
          <PanelBody>
            <KeyValue
              rows={[
                { label: 'Observer location', value: plan.locationName, mono: false },
                { label: 'Objects', value: plan.objectIds.length },
                { label: 'Objects scanned', value: data.objectIds.length },
                { label: 'From', value: `${dateShort(plan.startsAt)} ${timeShort(plan.startsAt)}` },
                { label: 'To', value: `${dateShort(plan.endsAt)} ${timeShort(plan.endsAt)}` },
                { label: 'Minimum quality', value: plan.minScore ? num(plan.minScore * 100, 0) : 'any' },
                { label: 'Visible only', value: plan.visibleOnly ? 'yes' : 'no', mono: false },
                { label: 'Created', value: age(plan.createdAt) },
              ]}
            />
          </PanelBody>
          <PanelFooter>
            <InlineNote>
              Thresholds in force when this ran: minimum elevation{' '}
              {meta?.thresholds?.minElevationDeg}&deg;, twilight{' '}
              {meta?.thresholds?.twilightThresholdDeg}&deg;.
            </InlineNote>
          </PanelFooter>
        </Panel>

        <Panel>
          <PanelHeader
            title="Session timeline"
            subtitle="Each bar is a kept window, positioned across the plan range and shaded by quality."
            icon={Clock}
          />
          <PanelBody>
            {timeline ? (
              <div className="space-y-2.5">
                {timeline.windows.map((w) => {
                  const left = ((new Date(w.aos).getTime() - timeline.start) / timeline.span) * 100;
                  const width = Math.max(
                    0.8,
                    ((new Date(w.los).getTime() - new Date(w.aos).getTime()) / timeline.span) * 100,
                  );
                  return (
                    <div key={w.id} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-2xs text-ink-dim">{w.objectName}</span>
                        <span className="tnum shrink-0 font-mono text-2xs text-ink-faint">
                          {timeShort(w.aos)} &middot; {deg(w.maxElevation, 0)} &middot; {duration(w.durationSeconds)}
                        </span>
                      </div>
                      <div className="relative h-2 w-full rounded-full bg-overlay">
                        <div
                          className={
                            w.visibility.visible
                              ? 'absolute h-2 rounded-full bg-good'
                              : 'absolute h-2 rounded-full bg-primary/60'
                          }
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`${w.objectName}, quality ${num(w.score * 100, 0)}`}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between border-t border-line pt-2 font-mono text-2xs text-ink-faint">
                  <span>{dateShort(timeline.start)} {timeShort(timeline.start)}</span>
                  <span>{dateShort(timeline.end)} {timeShort(timeline.end)}</span>
                </div>
              </div>
            ) : (
              <EmptyState compact icon={Clock} title="Nothing to lay out" description="No windows were kept for this plan." />
            )}
          </PanelBody>
        </Panel>
      </div>

      <Section title="Kept windows" description="Ranked by quality, then resolved against the turnaround gap and laid out in time order.">
        <Panel>
          <DataTable
            rowKey={(p) => p.id}
            onRowClick={(p) => navigate(`/app/pass/${p.objectId}?aos=${encodeURIComponent(p.aos)}`)}
            columns={[
              {
                key: 'aos',
                header: 'Window (UTC)',
                render: (p) => (
                  <div>
                    <p className="tnum font-mono text-ink">
                      {dateShort(p.aos)} {timeShort(p.aos, true)}
                    </p>
                    <p className="text-2xs text-ink-faint">to {timeShort(p.los, true)}</p>
                  </div>
                ),
              },
              { key: 'objectName', header: 'Object', nowrap: false },
              { key: 'maxElevation', header: 'Max el.', align: 'right', mono: true, render: (p) => deg(p.maxElevation, 1) },
              { key: 'durationSeconds', header: 'Duration', align: 'right', mono: true, render: (p) => duration(p.durationSeconds) },
              {
                key: 'path',
                header: 'Path',
                hideBelow: 'lg',
                render: (p) => (
                  <span className="tnum font-mono text-2xs">
                    {compass(p.azimuthAos)} &rarr; {compass(p.azimuthLos)}
                  </span>
                ),
              },
              { key: 'magnitude', header: 'Magnitude', hideBelow: 'md', render: (p) => <MagnitudeBadge magnitude={p.magnitude} magnitudeClass={p.magnitudeClass} /> },
              { key: 'eclipse', header: 'Light', hideBelow: 'xl', render: (p) => <EclipseBadge state={p.eclipseState} /> },
              { key: 'visibility', header: 'Visibility', render: (p) => <VisibilityBadge visibility={p.visibility} /> },
              { key: 'score', header: 'Quality', align: 'right', render: (p) => <QualityBadge band={p.scoreBand} score={p.score} degraded={p.scoreDegraded} /> },
            ]}
            rows={windows}
            empty={
              <EmptyState
                icon={CalendarRange}
                title="No windows in this plan"
                description="Nothing on this plan comes within range of the site in this date range, under these thresholds."
              />
            }
          />
        </Panel>
      </Section>

      {conflicts.length > 0 && (
        <Section
          title="Displaced windows"
          description="These overlap a higher-scoring window, or fall inside the turnaround gap after it. They are listed rather than hidden so the decision can be reversed."
        >
          <Panel>
            <DataTable
              dense
              rowKey={(p) => p.id}
              columns={[
                {
                  key: 'aos',
                  header: 'Window (UTC)',
                  render: (p) => (
                    <span className="tnum font-mono">
                      {dateShort(p.aos)} {timeShort(p.aos, true)}
                    </span>
                  ),
                },
                { key: 'objectName', header: 'Object', nowrap: false },
                { key: 'maxElevation', header: 'Max el.', align: 'right', mono: true, render: (p) => deg(p.maxElevation, 1) },
                { key: 'score', header: 'Quality', align: 'right', render: (p) => <QualityBadge band={p.scoreBand} score={p.score} /> },
                {
                  key: 'droppedFor',
                  header: 'Displaced by',
                  nowrap: false,
                  render: (p) => (
                    <div className="min-w-0">
                      <p className="truncate text-ink-dim">{p.droppedFor?.objectName}</p>
                      <p className="truncate text-2xs text-ink-faint">{p.reason}</p>
                    </div>
                  ),
                },
              ]}
              rows={conflicts}
            />
          </Panel>
        </Section>
      )}

      {refused.length > 0 && (
        <Banner tone="warn" title="Objects not propagated">
          {refused.map((r) => r.objectName).join(', ')}. {refused[0].reason} Past the propagation
          horizon the engine refuses rather than extrapolating, which is the behaviour the
          specification requires.
        </Banner>
      )}

      <Panel>
        <PanelBody className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-2xs text-ink-faint">
            {percent(counts.total === 0 ? 0 : counts.visible / counts.total)} of horizon crossings in
            this plan satisfied every visibility clause.
          </p>
          <Link to="/app/log" className="link inline-flex items-center gap-1 text-2xs">
            Record what you actually observed
            <ArrowRight size={11} aria-hidden />
          </Link>
        </PanelBody>
      </Panel>
    </div>
  );
}

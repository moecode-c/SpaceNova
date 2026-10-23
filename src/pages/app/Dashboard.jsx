import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Binoculars, CalendarRange, ClipboardList, Cloud, Eye,
  Gauge, MapPin, Moon, Radar, Rocket, Sun, Timer, TrendingUp,
} from 'lucide-react';
import { Grid, KeyValue, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, Section, StatTile, Meter } from '../../components/ui/panel.jsx';
import { DataTable } from '../../components/ui/table.jsx';
import { Badge, Button, Tag } from '../../components/ui/primitives.jsx';
import { Banner, EmptyState, InlineNote, LoadingState } from '../../components/ui/feedback.jsx';
import { WorldMap } from '../../components/map/WorldMap.jsx';
import { PolarPassChart } from '../../components/map/PolarChart.jsx';
import { SourceTag, DegradedBanner } from '../../components/data/source.jsx';
import {
  EclipseBadge, FreshnessBadge, MagnitudeBadge, QualityBadge, VisibilityBadge,
} from '../../components/data/badges.jsx';
import { useApi, useClock } from '../../hooks/useApi.js';
import { useTracking } from '../../hooks/useTracking.js';
import {
  events as eventsApi, launches as launchesApi, observations as observationsApi,
  passes as passesApi, plans as plansApi, spaceWeather as weatherApi, tracking,
} from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { satrecFor } from '../../engine/propagate.js';
import { passTrack } from '../../engine/passes.js';
import {
  compass, dateShort, deg, duration, num, percent, timeShort, age, km,
} from '../../lib/format.js';

export default function Dashboard() {
  const now = useClock(1000);
  const { user } = useAuth();
  const { activeLocation, observer } = useSettings();

  const sky = useApi(() => eventsApi.skyNow(activeLocation?.id), [activeLocation?.id], {
    enabled: !!activeLocation,
  });
  const planList = useApi(() => plansApi.list(), []);

  /*
   * The dashboard reports on whichever plan is active, falling back to the
   * most recent one. Plans name their objects directly, so there is nothing
   * else to resolve.
   */
  const activePlan = useMemo(() => {
    const rows = planList.data ?? [];
    return rows.find((p) => p.status === 'active') ?? rows[0] ?? null;
  }, [planList.data]);

  const watchObjectIds = useMemo(() => activePlan?.objectIds ?? [], [activePlan]);

  const prediction = useApi(
    () =>
      passesApi.predict({
        objectIds: watchObjectIds,
        locationId: activeLocation?.id,
        hours: 48,
      }),
    [watchObjectIds, activeLocation?.id],
    { enabled: watchObjectIds.length > 0 && !!activeLocation },
  );

  const elementSets = useApi(
    () => tracking.elementSets(watchObjectIds.slice(0, 6)),
    [watchObjectIds],
    { enabled: watchObjectIds.length > 0 },
  );
  const { states, tracks } = useTracking(elementSets.data ?? [], observer, {
    intervalMs: 600,
    minElevationDeg: activeLocation?.minElevationDeg ?? 10,
  });

  const weather = useApi(() => weatherApi.summary(), []);
  const nextLaunch = useApi(() => launchesApi.next(1), []);
  const log = useApi(() => observationsApi.list({ pageSize: 5 }), []);

  const passes = prediction.data?.passes ?? [];
  const visible = passes.filter((p) => p.visibility.visible);
  const nextVisible = visible.find((p) => new Date(p.aos) > now) ?? null;
  const nextAny = passes.find((p) => new Date(p.aos) > now) ?? null;
  const tonight = passes.filter(
    (p) => new Date(p.aos).getTime() - now.getTime() < 18 * 3600000,
  );
  const aboveNow = states.filter((s) => s.aboveHorizon);

  // The polar track of the next visible pass, computed here because it needs
  // the element set rather than another request.
  const featuredTrack = useMemo(() => {
    const target = nextVisible ?? nextAny;
    if (!target || !observer) return [];
    const row = (elementSets.data ?? []).find((e) => e.objectId === target.objectId);
    if (!row) return [];
    const satrec = satrecFor(row.elementSet.line1, row.elementSet.line2);
    if (!satrec) return [];
    return passTrack(satrec, observer, target.aos, target.los, 60);
  }, [nextVisible, nextAny, observer, elementSets.data]);

  const featured = nextVisible ?? nextAny;

  if (!activeLocation) {
    return (
      <div className="space-y-5">
        <PageHeader
          icon={Gauge}
          title="Dashboard"
          description="Set an observer location to begin."
        />
        <Panel>
          <EmptyState
            icon={MapPin}
            title="No observer location yet"
            description="Pass prediction, look angles and visibility are all relative to a position on the ground. Add a site to get started."
            action={
              <Link to="/app/locations">
                <Button size="sm" variant="primary" icon={MapPin}>
                  Add an observer location
                </Button>
              </Link>
            }
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Gauge}
        title={`Good ${partOfDay(now)}, ${user?.name?.split(' ')[0] ?? 'there'}`}
        description={`Conditions and upcoming windows for ${activeLocation.name}. Every figure below carries its source and age.`}
        meta={
          <>
            <Badge tone={sky.data?.dark ? 'info' : 'warn'} icon={sky.data?.dark ? Moon : Sun}>
              {sky.data?.condition.label ?? 'Loading sky'}
            </Badge>
            <Tag>
              {activeLocation.latitude.toFixed(2)}, {activeLocation.longitude.toFixed(2)}
            </Tag>
            <Tag>min elevation {activeLocation.minElevationDeg}&deg;</Tag>
            {prediction.meta && <SourceTag meta={prediction.meta} />}
          </>
        }
        actions={
          <>
            <Link to="/app/tracker">
              <Button size="sm" variant="secondary" icon={Radar}>
                Live tracker
              </Button>
            </Link>
            <Link to="/app/planner">
              <Button size="sm" variant="primary" icon={CalendarRange}>
                Plan a session
              </Button>
            </Link>
          </>
        }
      />

      <DegradedBanner meta={prediction.meta} />

      <Grid cols={5}>
        <StatTile
          label="Next visible pass"
          value={nextVisible ? duration((new Date(nextVisible.aos) - now) / 1000) : '--'}
          hint={nextVisible ? nextVisible.objectName : 'None in the next 48 hours'}
          icon={Timer}
          tone={nextVisible ? 'good' : 'default'}
        />
        <StatTile
          label="Visible windows, 48 h"
          value={num(visible.length)}
          hint={`${num(passes.length)} horizon crossings in total`}
          icon={Eye}
        />
        <StatTile
          label="Above the horizon now"
          value={num(aboveNow.length)}
          hint={`Of ${num(states.length)} on the plan`}
          icon={Binoculars}
        />
        <StatTile
          label="Planetary K index"
          value={weather.data ? num(weather.data.kp, 1) : '--'}
          tone={weather.data?.kpBand.tone}
          hint={weather.data?.kpBand.label}
          icon={Gauge}
        />
        <StatTile
          label="Sun elevation"
          value={sky.data ? num(sky.data.sunElevation, 1) : '--'}
          unit="&deg;"
          hint={
            sky.data?.nextChangeAt
              ? `${sky.data.dark ? 'Light returns' : 'Dark at'} ${timeShort(sky.data.nextChangeAt)}`
              : 'Threshold -12°'
          }
          icon={sky.data?.dark ? Moon : Sun}
        />
      </Grid>

      {/* ----------------------------------------------- next pass + tracker */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <Panel>
          <PanelHeader
            title={nextVisible ? 'Next visible pass' : 'Next pass above the horizon'}
            subtitle={
              featured
                ? `${featured.objectName}, ${age(featured.aos)}`
                : 'Nothing in the prediction window'
            }
            icon={Binoculars}
            actions={featured && <QualityBadge band={featured.scoreBand} score={featured.score} degraded={featured.scoreDegraded} />}
          />
          {prediction.loading ? (
            <LoadingState label="Scanning the horizon" compact />
          ) : featured ? (
            <>
              <PanelBody className="space-y-4">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <PolarPassChart
                    track={featuredTrack}
                    horizonMask={activeLocation.horizonMask}
                    minElevation={activeLocation.minElevationDeg}
                    size={230}
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-3">
                    <KeyValue
                      dense
                      rows={[
                        { label: 'Object', value: featured.objectName, mono: false },
                        { label: 'Acquisition', value: `${timeShort(featured.aos, true)} UTC` },
                        { label: 'Closest approach', value: `${timeShort(featured.tca, true)} UTC` },
                        { label: 'Loss of signal', value: `${timeShort(featured.los, true)} UTC` },
                        { label: 'Duration', value: duration(featured.durationSeconds) },
                        { label: 'Maximum elevation', value: deg(featured.maxElevation, 1) },
                        {
                          label: 'Path',
                          value: `${compass(featured.azimuthAos)} to ${compass(featured.azimuthLos)} via ${compass(featured.azimuthTca)}`,
                          mono: false,
                        },
                        { label: 'Range at closest', value: km(featured.rangeAtTcaKm, 0) },
                      ]}
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <VisibilityBadge visibility={featured.visibility} />
                      <EclipseBadge state={featured.eclipseState} />
                      <MagnitudeBadge magnitude={featured.magnitude} magnitudeClass={featured.magnitudeClass} />
                      {featured.cloudCover !== null && (
                        <Badge tone={featured.cloudCover > 0.6 ? 'warn' : 'default'} size="sm" icon={Cloud}>
                          {percent(featured.cloudCover)} cloud
                        </Badge>
                      )}
                      <FreshnessBadge freshness={featured.freshness} />
                    </div>
                  </div>
                </div>

                {/* Score breakdown. The requirement is that a ranking is
                    explainable, so the terms are on screen, not in a tooltip. */}
                <div className="space-y-2 border-t border-line pt-3.5">
                  <p className="label-caps">Quality score terms</p>
                  {featured.scoreTerms.map((term) => (
                    <Meter
                      key={term.key}
                      value={term.value}
                      tone={term.degraded ? 'warn' : 'primary'}
                      label={term.label}
                      right={`${num(term.value * 100, 0)} / 100 at ${num(term.weight * 100, 0)}% weight`}
                      height="h-1"
                    />
                  ))}
                  {featured.scoreDegraded && (
                    <InlineNote>
                      One term was unavailable and the remaining weights were renormalised, so this
                      score is not directly comparable with a fully scored window.
                    </InlineNote>
                  )}
                </div>
              </PanelBody>
              <PanelFooter>
                <Link
                  to={`/app/pass/${featured.objectId}?aos=${encodeURIComponent(featured.aos)}`}
                  className="link inline-flex items-center gap-1 text-xs"
                >
                  Open the full pass detail
                  <ArrowRight size={12} aria-hidden />
                </Link>
              </PanelFooter>
            </>
          ) : (
            <EmptyState
              icon={Binoculars}
              compact
              title="No passes in the next 48 hours"
              description="Add more objects to the plan, or lower the minimum elevation for this site."
              action={
                <Link to="/app/planner">
                  <Button size="sm" variant="outline">
                    Open the planner
                  </Button>
                </Link>
              }
            />
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title={activePlan ? `${activePlan.name}, live` : 'Tracked objects, live'}
            subtitle="Positions propagated in this browser from the cached element sets."
            icon={Radar}
            actions={elementSets.meta && <SourceTag meta={elementSets.meta} compact />}
          />
          <PanelBody padded={false}>
            <WorldMap
              mode="flat"
              height={300}
              satellites={states
                .filter((s) => !s.error)
                .map((s) => ({
                  id: s.objectId,
                  name: s.name,
                  latitude: s.latitude,
                  longitude: s.longitude,
                  footprintAngleDeg: s.footprintAngleDeg,
                  eclipsed: s.eclipsed,
                }))}
              tracks={tracks.map((t) => ({ ...t, colour: '#4d9bff' }))}
              observer={{ ...observer, name: activeLocation.name }}
              showFootprints={false}
              showLabels={false}
              interactive={false}
              className="rounded-none border-0 border-b"
            />
            <DataTable
              dense
              columns={[
                {
                  key: 'name',
                  header: 'Object',
                  nowrap: false,
                  render: (s) => (
                    <div className="min-w-0">
                      <p className="truncate text-ink">{s.name}</p>
                      <p className="tnum truncate font-mono text-2xs text-ink-faint">{s.noradId}</p>
                    </div>
                  ),
                },
                {
                  key: 'elevation',
                  header: 'Elevation',
                  align: 'right',
                  mono: true,
                  render: (s) =>
                    s.elevation === null ? (
                      '--'
                    ) : (
                      <span className={s.aboveHorizon ? 'text-good' : 'text-ink-faint'}>
                        {deg(s.elevation, 1)}
                      </span>
                    ),
                },
                {
                  key: 'azimuth',
                  header: 'Azimuth',
                  align: 'right',
                  mono: true,
                  hideBelow: 'md',
                  render: (s) => (s.azimuth === null ? '--' : `${compass(s.azimuth)} ${deg(s.azimuth, 0)}`),
                },
                {
                  key: 'altitudeKm',
                  header: 'Altitude',
                  align: 'right',
                  mono: true,
                  hideBelow: 'lg',
                  render: (s) => km(s.altitudeKm, 0),
                },
                {
                  key: 'eclipse',
                  header: 'Light',
                  hideBelow: 'xl',
                  render: (s) => <EclipseBadge state={s.eclipse?.state} />,
                },
              ]}
              rows={states.filter((s) => !s.error).slice(0, 6)}
              rowKey={(s) => s.objectId}
              empty={
                <EmptyState
                  compact
                  icon={Binoculars}
                  title="No objects on the plan"
                  description="Add objects to an observation plan to track them here."
                />
              }
            />
          </PanelBody>
        </Panel>
      </div>

      {/* ------------------------------------------------- tonight's windows */}
      <Section
        title="Windows in the next eighteen hours"
        description="Ranked by quality. A window above the horizon that fails a visibility clause is listed with the clause that failed."
        actions={
          <Link to="/app/planner">
            <Button size="sm" variant="ghost" iconRight={ArrowRight}>
              Full planner
            </Button>
          </Link>
        }
      >
        <Panel>
          <DataTable
            loading={prediction.loading}
            columns={[
              {
                key: 'aos',
                header: 'Acquisition',
                render: (p) => (
                  <div>
                    <p className="tnum font-mono text-ink">{timeShort(p.aos, true)}</p>
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
              { key: 'maxElevation', header: 'Max elevation', align: 'right', mono: true, render: (p) => deg(p.maxElevation, 1) },
              { key: 'durationSeconds', header: 'Duration', align: 'right', mono: true, render: (p) => duration(p.durationSeconds) },
              {
                key: 'magnitude',
                header: 'Magnitude',
                hideBelow: 'md',
                render: (p) => <MagnitudeBadge magnitude={p.magnitude} magnitudeClass={p.magnitudeClass} />,
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
            rows={tonight}
            empty={
              <EmptyState
                compact
                icon={CalendarRange}
                title="Nothing in the next eighteen hours"
                description="Nothing on the plan comes within range of this site tonight."
              />
            }
          />
          {prediction.data && (
            <PanelFooter>
              <span className="text-2xs text-ink-faint">
                Thresholds applied: minimum elevation {prediction.meta?.thresholds?.minElevationDeg}
                &deg;, twilight {prediction.meta?.thresholds?.twilightThresholdDeg}&deg;, refined to{' '}
                {prediction.meta?.thresholds?.refineToleranceSeconds} s.
              </span>
            </PanelFooter>
          )}
        </Panel>
      </Section>

      {/* ------------------------------------------------------- side panels */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel>
          <PanelHeader title="Space weather" icon={Sun} actions={weather.meta && <SourceTag meta={weather.meta} compact />} />
          <PanelBody className="space-y-3">
            {weather.data ? (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="label-caps">Kp</p>
                    <p className="tnum mt-1 font-mono text-2xl font-semibold text-ink">
                      {num(weather.data.kp, 1)}
                    </p>
                  </div>
                  <Badge tone={weather.data.kpBand.tone} dot>
                    {weather.data.kpBand.label}
                  </Badge>
                </div>
                <KeyValue
                  dense
                  columns={2}
                  rows={[
                    { label: 'Solar wind', value: `${num(weather.data.solarWindSpeedKms, 0)} km/s` },
                    { label: 'Bz', value: `${num(weather.data.bzNt, 1)} nT` },
                    { label: 'X-ray', value: weather.data.xrayClass.label },
                    { label: 'Aurora', value: percent(weather.data.auroraProbability) },
                  ]}
                />
                <InlineNote>
                  The same indices scale the atmospheric density used by the decay estimates.
                </InlineNote>
              </>
            ) : (
              <LoadingState compact label="Loading" />
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Recent observations" icon={ClipboardList} actions={log.meta && <SourceTag meta={log.meta} compact />} />
          <PanelBody padded={false}>
            <ul className="divide-y divide-line">
              {(log.data?.rows ?? []).map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-ink">{entry.objectName}</p>
                    <p className="truncate text-2xs text-ink-faint">
                      {dateShort(entry.observedAt)} &middot; {entry.locationName}
                    </p>
                  </div>
                  <Badge tone={entry.outcomeTone} size="sm">
                    {entry.outcomeLabel}
                  </Badge>
                </li>
              ))}
              {(log.data?.rows ?? []).length === 0 && (
                <li className="px-4 py-6 text-center text-2xs text-ink-faint">No entries yet.</li>
              )}
            </ul>
          </PanelBody>
          {log.data?.stats && (
            <PanelFooter>
              <span className="text-2xs text-ink-faint">
                {percent(log.data.stats.successRate)} of logged attempts observed. Mean acquisition
                error{' '}
                {log.data.stats.meanAbsoluteAcquisitionErrorSeconds === null
                  ? 'not available'
                  : `${num(log.data.stats.meanAbsoluteAcquisitionErrorSeconds, 1)} s`}
                .
              </span>
            </PanelFooter>
          )}
        </Panel>

        <div className="space-y-3">
          <Panel>
            <PanelHeader title="Next launch" icon={Rocket} />
            <PanelBody className="space-y-2">
              {nextLaunch.data?.[0] ? (
                <>
                  <p className="text-sm font-semibold text-ink">{nextLaunch.data[0].payloadName}</p>
                  <p className="text-2xs text-ink-faint">
                    {nextLaunch.data[0].vehicle} &middot; {nextLaunch.data[0].provider}
                  </p>
                  <p className="tnum font-mono text-xs text-ink-dim">
                    {duration((new Date(nextLaunch.data[0].net) - now) / 1000)} to the window
                  </p>
                  <Link to={`/launches/${nextLaunch.data[0].id}`} className="link inline-flex items-center gap-1 text-2xs">
                    Launch record
                    <ArrowRight size={11} aria-hidden />
                  </Link>
                </>
              ) : (
                <LoadingState compact label="Loading" />
              )}
            </PanelBody>
          </Panel>

        </div>
      </div>

      {sky.data && !sky.data.dark && (
        <Banner tone="info" title="The sky here is not dark yet" icon={TrendingUp}>
          The sun is at {deg(sky.data.sunElevation, 1)} against a threshold of{' '}
          {deg(sky.data.threshold, 0)}. Visible passes resume
          {sky.data.nextChangeAt ? ` around ${timeShort(sky.data.nextChangeAt)} UTC` : ' once it falls below the threshold'}.
          Passes above the horizon are still listed, marked as not visible.
        </Banner>
      )}
    </div>
  );
}

function partOfDay(date) {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

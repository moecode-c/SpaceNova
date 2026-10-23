import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Antenna, Binoculars, Clock, Copy, Cpu, History, Orbit, Radar, Satellite, TrendingDown,
} from 'lucide-react';
import {
  Grid, KeyValue, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, Section, StatTile,
} from '../../components/ui/panel.jsx';
import { Breadcrumbs, SegmentedControl, Tabs } from '../../components/ui/nav.jsx';
import { Badge, Button, Tag } from '../../components/ui/primitives.jsx';
import { ErrorState, LoadingState, Banner, InlineNote, useToast } from '../../components/ui/feedback.jsx';
import { DataTable } from '../../components/ui/table.jsx';
import { WorldMap } from '../../components/map/WorldMap.jsx';
import { SourceTag, FixtureNotice, ComputedNotice } from '../../components/data/source.jsx';
import {
  BandTags, EclipseBadge, FreshnessBadge, MagnitudeBadge, OrbitBadge, QualityBadge,
  StatusBadge, VisibilityBadge,
} from '../../components/data/badges.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useTracking } from '../../hooks/useTracking.js';
import { catalog, passes as passesApi, tracking } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import {
  compass, dateShort, dateTime, deg, duration, hz, km, kms, latLon, mag, num, percent, timeShort,
} from '../../lib/format.js';

export default function ObjectDetail() {
  const { objectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { observer, activeLocation } = useSettings();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [mapMode, setMapMode] = useState('flat');

  const object = useApi(() => catalog.get(objectId), [objectId]);
  const elementSets = useApi(() => tracking.elementSets([objectId]), [objectId]);
  const history = useApi(() => catalog.elementSets(objectId), [objectId], { enabled: tab === 'elements' });

  const upcoming = useApi(
    () =>
      passesApi.predict({
        objectIds: [objectId],
        locationId: activeLocation?.id,
        hours: 96,
      }),
    [objectId, activeLocation?.id],
    { enabled: !!user && !!activeLocation },
  );

  const { states, tracks } = useTracking(elementSets.data ?? [], observer, {
    intervalMs: 500,
    minElevationDeg: activeLocation?.minElevationDeg ?? 10,
  });
  const live = states[0];

  const row = object.data;

  const mapSatellites = useMemo(
    () =>
      live && !live.error
        ? [
            {
              id: live.objectId,
              name: live.name,
              latitude: live.latitude,
              longitude: live.longitude,
              footprintAngleDeg: live.footprintAngleDeg,
              eclipsed: live.eclipsed,
            },
          ]
        : [],
    [live],
  );

  if (object.loading && !row) return <LoadingState label="Loading catalogue record" />;
  if (object.error) return <ErrorState error={object.error} onRetry={object.reload} />;
  if (!row) return null;

  const copyTle = async () => {
    const text = `${row.name}\n${row.elementSet.line1}\n${row.elementSet.line2}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Element set copied', 'Three lines, ready to paste into a tracking tool.');
    } catch {
      toast.error('Could not copy', 'The browser refused clipboard access.');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Satellite}
        title={row.name}
        breadcrumb={
          <Breadcrumbs
            items={[
              { label: 'Catalogue', to: '/catalog' },
              { label: row.categoryLabel, to: '/catalog' },
              { label: row.name },
            ]}
          />
        }
        description={`${row.categoryLabel} operated by ${row.operator}. Launched ${dateShort(
          row.launchDate,
        )} from the ${row.country} registry.`}
        meta={
          <>
            <OrbitBadge orbitClass={row.orbitClass} />
            <StatusBadge status={row.status} />
            <FreshnessBadge freshness={row.freshness} />
            {live && !live.error && <EclipseBadge state={live.eclipse.state} />}
            <Tag>NORAD {row.noradId}</Tag>
            <Tag>{row.intlDes}</Tag>
            {object.meta && <SourceTag meta={object.meta} />}
          </>
        }
        actions={
          <>
            <Button size="sm" variant="secondary" icon={Copy} onClick={copyTle}>
              Copy element set
            </Button>
            {user && (
              <Link to={`/app/tracker?objects=${row.id}`}>
                <Button size="sm" variant="primary" icon={Radar}>
                  Track live
                </Button>
              </Link>
            )}
          </>
        }
      />

      {!row.freshness.usable && (
        <Banner tone="bad" title="Element set expired">
          The epoch of this element set is beyond the propagation horizon, so the engine refuses to
          predict from it. Positions and passes are not shown until a newer set arrives.
        </Banner>
      )}

      {/* Live state. Computed in the browser, labelled as such. */}
      {live && !live.error && row.freshness.usable && (
        <Grid cols={6}>
          <StatTile label="Altitude" value={num(live.altitudeKm, 1)} unit="km" icon={Orbit} />
          <StatTile label="Speed" value={num(live.speedKms, 3)} unit="km/s" />
          <StatTile label="Latitude" value={num(live.latitude, 3)} unit="&deg;" />
          <StatTile label="Longitude" value={num(live.longitude, 3)} unit="&deg;" />
          <StatTile
            label="Footprint radius"
            value={num(live.footprintRadiusKm, 0)}
            unit="km"
            hint={`Above ${activeLocation?.minElevationDeg ?? 10}°`}
          />
          <StatTile
            label="Elevation here"
            value={live.elevation === null ? '--' : num(live.elevation, 1)}
            unit="&deg;"
            tone={live.aboveHorizon ? 'good' : 'default'}
            hint={
              live.elevation === null
                ? 'Set an observer location'
                : live.aboveHorizon
                  ? `Above the horizon, ${compass(live.azimuth)}`
                  : 'Below the horizon'
            }
          />
        </Grid>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview', icon: Satellite },
          { value: 'position', label: 'Position', icon: Radar },
          { value: 'passes', label: 'Passes', icon: Binoculars, count: upcoming.data?.counts.shown },
          { value: 'elements', label: 'Element sets', icon: History },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Catalogue record" icon={Satellite} />
            <PanelBody>
              <KeyValue
                rows={[
                  { label: 'Catalogue number', value: row.noradId },
                  { label: 'International designator', value: row.intlDes },
                  { label: 'Object type', value: row.type, mono: false },
                  { label: 'Category', value: row.categoryLabel, mono: false },
                  { label: 'Operator', value: row.operator, mono: false },
                  { label: 'Registry', value: row.country, mono: false },
                  { label: 'Launch date', value: dateShort(row.launchDate) },
                  { label: 'Mass', value: row.massKg ? `${num(row.massKg)} kg` : '--' },
                  { label: 'Radar cross-section', value: row.rcsM2 ? `${num(row.rcsM2, 2)} m²` : '--' },
                  { label: 'Standard magnitude', value: mag(row.standardMagnitude) },
                  { label: 'Downlink', value: row.downlinkHz ? hz(row.downlinkHz) : 'not published' },
                  { label: 'Bands', value: <BandTags bands={row.bands} />, mono: false },
                ]}
              />
            </PanelBody>
            <PanelFooter>
              <InlineNote>
                Standard magnitude is the brightness at 1 000 km range and half illumination. It is
                the input to the magnitude estimate, not an observed value.
              </InlineNote>
            </PanelFooter>
          </Panel>

          <div className="space-y-3">
            <Panel>
              <PanelHeader title="Orbit" icon={Orbit} />
              <PanelBody>
                <KeyValue
                  columns={2}
                  rows={[
                    { label: 'Orbit class', value: row.orbitClass },
                    { label: 'Period', value: `${num(row.periodMinutes, 2)} min` },
                    { label: 'Apogee altitude', value: km(row.apogeeKm, 1) },
                    { label: 'Perigee altitude', value: km(row.perigeeKm, 1) },
                    { label: 'Inclination', value: deg(row.inclination, 4) },
                    { label: 'Eccentricity', value: num(row.eccentricity, 7) },
                    { label: 'Semi-major axis', value: km(row.elementSet.semiMajorAxisKm, 1) },
                    { label: 'Mean motion', value: `${num(row.elementSet.meanMotion, 8)} rev/day` },
                    { label: 'RAAN', value: deg(row.elementSet.raan, 4) },
                    { label: 'Argument of perigee', value: deg(row.elementSet.argPerigee, 4) },
                    { label: 'Mean anomaly', value: deg(row.elementSet.meanAnomaly, 4) },
                    { label: 'Drag term (B*)', value: row.elementSet.bstar.toExponential(4) },
                  ]}
                />
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                title="Latest element set"
                subtitle={`Epoch ${dateTime(row.elementSet.epoch, true)} UTC`}
                icon={Clock}
                actions={<FreshnessBadge freshness={row.freshness} />}
              />
              <PanelBody>
                <pre className="overflow-x-auto rounded-md border border-line bg-void px-3 py-2.5 font-code text-[0.68rem] leading-relaxed text-ink-dim">
                  {row.elementSet.line1}
                  {'\n'}
                  {row.elementSet.line2}
                </pre>
                <div className="mt-3 space-y-2">
                  <KeyValue
                    dense
                    columns={2}
                    rows={[
                      { label: 'Epoch age', value: `${num(row.freshness.ageHours, 1)} h` },
                      { label: 'Band', value: row.freshness.label, mono: false },
                      {
                        label: 'Uncertainty band',
                        value: `±${num(row.freshness.estimatedErrorKm, 1)} km`,
                      },
                      { label: 'Element set number', value: row.elementSet.elsetNumber },
                    ]}
                  />
                  <InlineNote>
                    The uncertainty band is an order-of-magnitude figure from the epoch age, not a
                    covariance. It grows faster for low-perigee, high-drag objects.
                  </InlineNote>
                </div>
              </PanelBody>
            </Panel>
          </div>
        </div>
      )}

      {tab === 'position' && (
        <Section
          title="Current position"
          description="Propagated in this browser from the element set above. The footprint is the circle inside which the object is above the minimum elevation."
          actions={
            <SegmentedControl
              size="sm"
              ariaLabel="Map projection"
              value={mapMode}
              onChange={setMapMode}
              options={[
                { value: 'flat', label: 'Flat' },
                { value: 'globe', label: 'Globe' },
              ]}
            />
          }
        >
          <ComputedNotice />
          <WorldMap
            mode={mapMode}
            height={440}
            satellites={mapSatellites}
            tracks={tracks.map((t) => ({ ...t, colour: '#ffffff' }))}
            observer={observer ? { ...observer, name: activeLocation?.name } : undefined}
            selectedId={live?.objectId}
            showFootprints
          />
          {live && !live.error && (
            <Grid cols={4}>
              <StatTile label="Sub-satellite point" value={latLon(live.latitude, live.longitude, 2)} />
              <StatTile
                label="Illumination"
                value={live.eclipse.state}
                hint="Conical Earth-shadow test against the solar position"
              />
              <StatTile
                label="Slant range"
                value={live.rangeKm === null ? '--' : num(live.rangeKm, 0)}
                unit="km"
                hint={observer ? `From ${activeLocation?.name}` : 'No observer location set'}
              />
              <StatTile
                label="Doppler shift"
                value={live.dopplerHz === null ? '--' : num(live.dopplerHz / 1000, 2)}
                unit="kHz"
                hint={row.downlinkHz ? `On ${hz(row.downlinkHz)}` : 'No published downlink'}
              />
            </Grid>
          )}
        </Section>
      )}

      {tab === 'passes' && (
        <Section
          title="Upcoming passes"
          description={
            activeLocation
              ? `Next 96 hours from ${activeLocation.name}. Windows are found by a coarse scan and refined to the second.`
              : 'Sign in and set an observer location to see passes.'
          }
          actions={upcoming.meta && <SourceTag meta={upcoming.meta} />}
        >
          {!user ? (
            <Panel>
              <PanelBody>
                <Banner tone="info" title="Passes need an observer location">
                  Pass prediction is relative to a position on the ground. Sign in to set one, or
                  create an account and save several sites.
                  <div className="mt-2.5 flex gap-2">
                    <Link to="/login">
                      <Button size="xs" variant="primary">
                        Sign in
                      </Button>
                    </Link>
                    <Link to="/register">
                      <Button size="xs" variant="ghost">
                        Create account
                      </Button>
                    </Link>
                  </div>
                </Banner>
              </PanelBody>
            </Panel>
          ) : upcoming.loading ? (
            <Panel>
              <LoadingState label="Scanning the horizon" />
            </Panel>
          ) : (
            <Panel>
              <DataTable
                columns={[
                  {
                    key: 'aos',
                    header: 'Acquisition',
                    render: (p) => (
                      <div>
                        <p className="tnum font-mono text-ink">{timeShort(p.aos, true)}</p>
                        <p className="text-2xs text-ink-faint">{dateShort(p.aos)}</p>
                      </div>
                    ),
                  },
                  {
                    key: 'maxElevation',
                    header: 'Max elevation',
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
                    key: 'azimuthAos',
                    header: 'Path',
                    hideBelow: 'md',
                    render: (p) => (
                      <span className="tnum font-mono text-2xs">
                        {compass(p.azimuthAos)} &rarr; {compass(p.azimuthTca)} &rarr; {compass(p.azimuthLos)}
                      </span>
                    ),
                  },
                  {
                    key: 'magnitude',
                    header: 'Magnitude',
                    hideBelow: 'lg',
                    render: (p) => <MagnitudeBadge magnitude={p.magnitude} magnitudeClass={p.magnitudeClass} />,
                  },
                  {
                    key: 'visibility',
                    header: 'Visibility',
                    render: (p) => <VisibilityBadge visibility={p.visibility} />,
                  },
                  {
                    key: 'score',
                    header: 'Quality',
                    align: 'right',
                    render: (p) => <QualityBadge band={p.scoreBand} score={p.score} degraded={p.scoreDegraded} />,
                  },
                ]}
                rows={upcoming.data?.passes ?? []}
                onRowClick={(p) =>
                  navigate(`/app/pass/${p.objectId}?aos=${encodeURIComponent(p.aos)}`)
                }
                empty={
                  <div className="px-4 py-10 text-center">
                    <p className="text-sm text-ink">No passes in the next 96 hours</p>
                    <p className="mx-auto mt-1 max-w-md text-xs text-ink-faint">
                      {row.orbitClass === 'GEO'
                        ? 'A geostationary object does not pass: it stays at a fixed look angle, or never rises at this latitude.'
                        : 'The ground track does not come within range of this location in the window scanned.'}
                    </p>
                  </div>
                }
              />
              {upcoming.data && (
                <PanelFooter>
                  <span className="text-2xs text-ink-faint">
                    {upcoming.data.counts.total} above the horizon, {upcoming.data.counts.visible}{' '}
                    satisfying all four visibility clauses.
                  </span>
                </PanelFooter>
              )}
            </Panel>
          )}
        </Section>
      )}

      {tab === 'elements' && (
        <Section
          title="Element set history"
          description="Each set as it arrived, with the change against the previous one. The engineering screens add residuals against the newest set."
          actions={history.meta && <SourceTag meta={history.meta} />}
        >
          <FixtureNotice compact />
          <Panel>
            <DataTable
              loading={history.loading}
              columns={[
                {
                  key: 'epoch',
                  header: 'Epoch (UTC)',
                  render: (s) => <span className="tnum font-mono">{dateTime(s.epoch, true)}</span>,
                },
                {
                  key: 'freshness',
                  header: 'Band',
                  render: (s) => <FreshnessBadge freshness={s.freshness} />,
                },
                {
                  key: 'meanMotion',
                  header: 'Mean motion',
                  align: 'right',
                  mono: true,
                  render: (s) => num(s.meanMotion, 8),
                },
                {
                  key: 'delta',
                  header: 'Change in mean motion',
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
                {
                  key: 'perigeeKm',
                  header: 'Perigee',
                  align: 'right',
                  mono: true,
                  hideBelow: 'lg',
                  render: (s) => km(s.perigeeKm, 1),
                },
                {
                  key: 'bstar',
                  header: 'B*',
                  align: 'right',
                  mono: true,
                  hideBelow: 'xl',
                  render: (s) => s.bstar.toExponential(3),
                },
                {
                  key: 'elsetNumber',
                  header: 'Set',
                  align: 'right',
                  mono: true,
                  hideBelow: 'xl',
                },
              ]}
              rows={history.data?.sets ?? []}
              rowKey={(s) => s.id}
            />
          </Panel>
          <InlineNote icon={Cpu}>
            A rising mean motion with a falling perigee is orbital decay. The engineering decay watch
            turns that trend into a re-entry window estimate, with its limitations stated.
          </InlineNote>
        </Section>
      )}

      {row.observationCount > 0 && (
        <Section title="Recorded observations" description={`${row.observationCount} entries in the log reference this object.`}>
          <Panel>
            <DataTable
              dense
              columns={[
                { key: 'observedAt', header: 'Date', mono: true, render: (o) => dateShort(o.observedAt) },
                { key: 'locationName', header: 'Site', hideBelow: 'md' },
                {
                  key: 'outcome',
                  header: 'Outcome',
                  render: (o) => <Badge tone={o.outcomeTone} size="sm">{o.outcomeLabel}</Badge>,
                },
                {
                  key: 'observedMaxElevation',
                  header: 'Max elevation',
                  align: 'right',
                  mono: true,
                  render: (o) => (o.observedMaxElevation ? deg(o.observedMaxElevation, 1) : '--'),
                },
                {
                  key: 'acquisitionErrorSeconds',
                  header: 'Acquisition error',
                  align: 'right',
                  mono: true,
                  hideBelow: 'lg',
                  render: (o) =>
                    o.acquisitionErrorSeconds === null ? '--' : `${o.acquisitionErrorSeconds > 0 ? '+' : ''}${num(o.acquisitionErrorSeconds, 1)} s`,
                },
                { key: 'notes', header: 'Note', nowrap: false, hideBelow: 'xl', render: (o) => <span className="line-clamp-1 text-ink-faint">{o.notes}</span> },
              ]}
              rows={row.recentObservations}
            />
          </Panel>
        </Section>
      )}

      {row.orbitClass === 'LEO' && row.perigeeKm < 700 && (
        <Banner tone="warn" title="Low perigee" icon={TrendingDown}>
          The perigee of {km(row.perigeeKm, 0)} puts this object in measurable atmospheric drag.
          Element sets go stale faster here, and the engineering decay watch carries a re-entry
          window estimate for it.
          <Link to="/app/engineering/decay" className="link ml-1">
            Open decay watch
          </Link>
        </Banner>
      )}

      {row.bands.length > 0 && (
        <InlineNote icon={Antenna}>
          Published bands are {row.bands.join(', ')}. Doppler figures assume the single downlink
          frequency recorded in the catalogue, {row.downlinkHz ? hz(row.downlinkHz) : 'which is not set for this object'}.
        </InlineNote>
      )}

      {upcoming.data?.counts && (
        <p className="text-2xs text-ink-faint">
          Pass yield from this site over the window scanned:{' '}
          {percent(
            upcoming.data.counts.total === 0
              ? 0
              : upcoming.data.counts.visible / upcoming.data.counts.total,
          )}{' '}
          of horizon crossings satisfied every visibility clause.
        </p>
      )}
    </div>
  );
}

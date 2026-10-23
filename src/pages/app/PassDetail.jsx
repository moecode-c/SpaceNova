import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, Binoculars, CheckCircle2, ClipboardList, Cloud, Compass, Timer, XCircle,
} from 'lucide-react';
import { Grid, KeyValue, Meter, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, Section, StatTile } from '../../components/ui/panel.jsx';
import { Breadcrumbs } from '../../components/ui/nav.jsx';
import { Badge, Button, Tag } from '../../components/ui/primitives.jsx';
import { Banner, ErrorState, InlineNote, LoadingState } from '../../components/ui/feedback.jsx';
import { PolarPassChart } from '../../components/map/PolarChart.jsx';
import { ChartCard, SERIES, TimeSeries } from '../../components/data/charts.jsx';
import { SourceTag } from '../../components/data/source.jsx';
import {
  EclipseBadge, FreshnessBadge, MagnitudeBadge, QualityBadge, VisibilityBadge,
} from '../../components/data/badges.jsx';
import { useApi, useClock } from '../../hooks/useApi.js';
import { passes as passesApi } from '../../api/index.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import {
  age, compass, dateShort, deg, duration, km, kms, mag, num, percent, timeShort,
} from '../../lib/format.js';

export default function PassDetail() {
  const { objectId } = useParams();
  const [params] = useSearchParams();
  const aos = params.get('aos');
  const now = useClock(1000);
  const { activeLocation } = useSettings();

  const { data, meta, loading, error, reload } = useApi(
    () => passesApi.detail({ objectId, aos, locationId: activeLocation?.id }),
    [objectId, aos, activeLocation?.id],
    { enabled: !!activeLocation },
  );

  const chartData = useMemo(
    () =>
      (data?.track ?? []).map((p) => ({
        t: p.t,
        elevation: p.elevation,
        azimuth: p.azimuth,
        lit: p.illuminated ? p.elevation : null,
      })),
    [data],
  );

  if (loading && !data) return <LoadingState label="Recomputing this pass" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const { pass, track, object, location } = data;
  const seconds = (new Date(pass.aos).getTime() - now.getTime()) / 1000;
  const inProgress = seconds < 0 && now < new Date(pass.los);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Binoculars}
        title={`${pass.objectName} pass`}
        breadcrumb={
          <Breadcrumbs
            items={[
              { label: 'Planner', to: '/app/planner' },
              { label: pass.objectName, to: `/catalog/${objectId}` },
              { label: `${dateShort(pass.aos)} ${timeShort(pass.aos)}` },
            ]}
          />
        }
        description={`From ${location.name}. Acquisition, closest approach and loss of signal are refined to the second by bisection on the elevation curve.`}
        meta={
          <>
            <VisibilityBadge visibility={pass.visibility} />
            <QualityBadge band={pass.scoreBand} score={pass.score} degraded={pass.scoreDegraded} />
            <EclipseBadge state={pass.eclipseState} />
            <MagnitudeBadge magnitude={pass.magnitude} magnitudeClass={pass.magnitudeClass} />
            <FreshnessBadge freshness={pass.freshness} />
            {meta && <SourceTag meta={meta} />}
          </>
        }
        actions={
          <>
            <Link to={`/catalog/${objectId}`}>
              <Button size="sm" variant="secondary">
                Catalogue record
              </Button>
            </Link>
            <Link to="/app/log">
              <Button size="sm" variant="primary" icon={ClipboardList}>
                Log an observation
              </Button>
            </Link>
          </>
        }
      />

      {inProgress && (
        <Banner tone="good" title="This pass is in progress">
          Loss of signal at {timeShort(pass.los, true)} UTC, in{' '}
          {duration((new Date(pass.los) - now) / 1000)}.
        </Banner>
      )}

      <Grid cols={5}>
        <StatTile
          label={seconds > 0 ? 'Time to acquisition' : 'Since acquisition'}
          value={duration(Math.abs(seconds))}
          tone={seconds > 0 && seconds < 3600 ? 'good' : 'default'}
          hint={`${timeShort(pass.aos, true)} UTC`}
          icon={Timer}
        />
        <StatTile label="Maximum elevation" value={num(pass.maxElevation, 1)} unit="&deg;" hint={`At ${timeShort(pass.tca, true)} UTC`} />
        <StatTile label="Duration" value={duration(pass.durationSeconds)} hint={`Above ${meta?.thresholds?.minElevationDeg ?? 10}°`} />
        <StatTile
          label="Range at closest"
          value={num(pass.rangeAtTcaKm, 0)}
          unit="km"
          hint={`Altitude ${km(pass.altitudeAtTcaKm, 0)}`}
        />
        <StatTile
          label="Estimated magnitude"
          value={pass.magnitude === null ? 'n/a' : mag(pass.magnitude)}
          hint={pass.magnitude === null ? 'Eclipsed throughout' : `±1.2, ${pass.magnitudeClass.label}`}
          tone={pass.magnitudeClass?.tone}
        />
      </Grid>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel>
          <PanelHeader
            title="Sky path"
            subtitle="Solid amber where the object is sunlit, dashed blue where it is in the Earth's shadow."
            icon={Compass}
          />
          <PanelBody className="flex justify-center">
            <PolarPassChart
              track={track}
              horizonMask={location.horizonMask}
              minElevation={meta?.thresholds?.minElevationDeg ?? 10}
              size={330}
            />
          </PanelBody>
          <PanelFooter>
            <InlineNote>
              The shaded sector is the horizon obstruction mask recorded for {location.name}. The
              dashed ring is the minimum elevation threshold.
            </InlineNote>
          </PanelFooter>
        </Panel>

        <div className="space-y-3">
          <ChartCard
            title="Elevation across the pass"
            subtitle="Hover to follow the same instant on the sky path."
            meta={meta}
            height={200}
          >
            <TimeSeries
              height={200}
              data={chartData}
              series={[
                { key: 'elevation', name: 'Elevation', colour: SERIES.primary, area: true },
                { key: 'lit', name: 'Sunlit', colour: SERIES.warn },
              ]}
              domain={[0, Math.ceil((pass.maxElevation + 8) / 10) * 10]}
              formatValue={(v) => deg(v, 1)}
              referenceLines={[
                { y: meta?.thresholds?.minElevationDeg ?? 10, label: 'threshold', colour: SERIES.warn },
              ]}
            />
          </ChartCard>

          <Panel>
            <PanelHeader title="Pass geometry" icon={Compass} />
            <PanelBody>
              <KeyValue
                columns={2}
                rows={[
                  { label: 'Acquisition', value: `${timeShort(pass.aos, true)} UTC` },
                  { label: 'Azimuth at AOS', value: `${deg(pass.azimuthAos, 1)} ${compass(pass.azimuthAos)}` },
                  { label: 'Closest approach', value: `${timeShort(pass.tca, true)} UTC` },
                  { label: 'Azimuth at TCA', value: `${deg(pass.azimuthTca, 1)} ${compass(pass.azimuthTca)}` },
                  { label: 'Loss of signal', value: `${timeShort(pass.los, true)} UTC` },
                  { label: 'Azimuth at LOS', value: `${deg(pass.azimuthLos, 1)} ${compass(pass.azimuthLos)}` },
                  { label: 'Range rate at TCA', value: kms(pass.rangeRateAtTcaKms, 3) },
                  { label: 'Phase angle', value: deg(pass.phaseAngle, 1) },
                  { label: 'Sun elevation', value: deg(pass.sunElevation, 1) },
                  {
                    label: 'Cloud forecast',
                    value: pass.cloudCover === null ? 'not available' : percent(pass.cloudCover),
                    mono: pass.cloudCover !== null,
                  },
                ]}
              />
            </PanelBody>
          </Panel>
        </div>
      </div>

      {/* ------------------------------------------------- visibility clauses */}
      <Section
        title="Visibility decision"
        description="All four clauses must hold for a pass to be reported as visible. Each is evaluated separately against the thresholds in force."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Panel>
            <PanelHeader
              title={pass.visibility.visible ? 'All clauses satisfied' : `Failed: ${pass.visibility.reason}`}
              icon={pass.visibility.visible ? CheckCircle2 : XCircle}
              actions={<VisibilityBadge visibility={pass.visibility} />}
            />
            <PanelBody padded={false}>
              <ul className="divide-y divide-line">
                {pass.visibility.clauses.map((clause) => (
                  <li key={clause.key} className="flex items-start gap-3 px-4 py-3">
                    {clause.pass ? (
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-good" aria-hidden />
                    ) : (
                      <XCircle size={15} className="mt-0.5 shrink-0 text-bad" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={clause.pass ? 'text-xs text-ink' : 'text-xs font-medium text-ink'}>
                        {clause.label}
                      </p>
                      <p className="mt-0.5 text-2xs leading-relaxed text-ink-faint">{clause.detail}</p>
                    </div>
                    <Badge tone={clause.pass ? 'good' : 'bad'} size="sm">
                      {clause.pass ? 'Pass' : 'Fail'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </PanelBody>
            {pass.visibility.obstructionDeg > 0 && (
              <PanelFooter>
                <InlineNote>
                  The horizon mask at azimuth {deg(pass.azimuthTca, 0)} is{' '}
                  {deg(pass.visibility.obstructionDeg, 1)}, measured for this site.
                </InlineNote>
              </PanelFooter>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Quality score"
              subtitle="Five normalised terms, each weighted. The score is what the planner ranks by."
              actions={<QualityBadge band={pass.scoreBand} score={pass.score} degraded={pass.scoreDegraded} />}
            />
            <PanelBody className="space-y-3.5">
              {pass.scoreTerms.map((term) => (
                <div key={term.key} className="space-y-1">
                  <Meter
                    value={term.value}
                    tone={term.degraded ? 'warn' : 'primary'}
                    label={term.label}
                    right={`${num(term.value * 100, 0)} / 100 at ${num(term.weight * 100, 0)}% weight`}
                    height="h-1.5"
                  />
                  <p className="text-2xs text-ink-faint">{term.detail}</p>
                </div>
              ))}
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-xs font-medium text-ink">Weighted total</span>
                <span className="tnum font-mono text-lg font-semibold text-ink">
                  {num(pass.score * 100, 1)}
                </span>
              </div>
              {pass.scoreDegraded && (
                <InlineNote icon={Cloud}>
                  No cloud forecast was available for this window, so that term was dropped and the
                  remaining weights renormalised. This score is not directly comparable with a fully
                  scored window.
                </InlineNote>
              )}
            </PanelBody>
          </Panel>
        </div>
      </Section>

      <Panel>
        <PanelHeader title="What this prediction rests on" />
        <PanelBody>
          <KeyValue
            columns={3}
            rows={[
              { label: 'Element set epoch', value: `${dateShort(object.elementSet.epoch)} ${timeShort(object.elementSet.epoch, true)}` },
              { label: 'Epoch age', value: `${num(pass.freshness.ageHours, 1)} h` },
              { label: 'Freshness band', value: pass.freshness.label, mono: false },
              { label: 'Uncertainty band', value: `±${num(pass.freshness.estimatedErrorKm, 1)} km` },
              { label: 'Minimum elevation', value: deg(meta?.thresholds?.minElevationDeg ?? 10, 0) },
              { label: 'Twilight threshold', value: deg(meta?.thresholds?.twilightThresholdDeg ?? -12, 0) },
              { label: 'Observer site', value: location.name, mono: false },
              { label: 'Computed', value: age(meta?.retrievedAt) },
              { label: 'Standard magnitude used', value: mag(object.standardMagnitude) },
            ]}
          />
        </PanelBody>
        <PanelFooter>
          <Link to={`/app/tracker?objects=${objectId}`} className="link inline-flex items-center gap-1 text-2xs">
            Follow this object on the live tracker
            <ArrowRight size={11} aria-hidden />
          </Link>
          <Tag className="ml-auto">{track.length} samples on the track</Tag>
        </PanelFooter>
      </Panel>
    </div>
  );
}

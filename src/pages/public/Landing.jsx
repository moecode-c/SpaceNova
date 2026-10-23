import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Antenna, Binoculars, Blocks, CalendarRange, Compass, Cpu, Database,
  Eye, FlaskConical, Globe2, Moon, Orbit, Radar, Rocket, Satellite, ShieldCheck,
  Signal, Sun, TrendingUp,
} from 'lucide-react';
import { Button, Badge, Tag } from '../../components/ui/primitives.jsx';
import { Panel, PanelBody, PanelHeader, Section, Grid } from '../../components/ui/panel.jsx';
import { SegmentedControl } from '../../components/ui/nav.jsx';
import { WorldMap } from '../../components/map/WorldMap.jsx';
import { SourceTag } from '../../components/data/source.jsx';
import { EclipseBadge, OrbitBadge } from '../../components/data/badges.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useTracking } from '../../hooks/useTracking.js';
import { tracking, launches as launchesApi, spaceWeather as weatherApi } from '../../api/index.js';
import { ROLES } from '../../mock/people.js';
import { km, kms, num, duration, dateShort, timeShort, percent, age } from '../../lib/format.js';

const CAPABILITIES = [
  {
    icon: Radar,
    title: 'Live tracking',
    body:
      'Positions are propagated in the browser from the cached element set, so the map runs at display rate without polling a server. Ground track, instantaneous footprint, eclipse state and look angles for your own location.',
  },
  {
    icon: CalendarRange,
    title: 'Observation planning',
    body:
      'Passes are found by a coarse scan and refined to the second, then ranked by a published quality score. Overlapping windows are resolved against a turnaround gap rather than silently dropped.',
  },
  {
    icon: Satellite,
    title: 'Object catalogue',
    body:
      'Search by name, catalogue number, operator, orbit class or perigee. Every record carries its element set, its freshness band and the uncertainty that comes with the epoch age.',
  },
  {
    icon: Rocket,
    title: 'Launch schedule',
    body:
      'Upcoming windows with their status and confidence, the pad and its coordinates, the payload and its destination, and the outcome once the flight has happened.',
  },
  {
    icon: Blocks,
    title: 'Vehicle design',
    body:
      'Assemble a launch vehicle from real engines, tanks and fairings and read its staged velocity change, lift-off thrust-to-weight and burn times, computed from the rocket equation rather than looked up.',
  },
  {
    icon: FlaskConical,
    title: 'Research workspaces',
    body:
      'Private projects with immutable dataset snapshots. Each snapshot records its query, its sources with retrieval times and licences, and the thresholds in force, so an export can be cited.',
  },
];

const CLAUSES = [
  ['Maximum elevation', 'Clears the minimum elevation threshold for the site.', Compass],
  ['Satellite sunlit', 'Outside the conical Earth shadow, tested against the solar position.', Sun],
  ['Observer in darkness', 'Sun below the twilight threshold, nautical by default.', Moon],
  ['Clear of the horizon mask', 'Not blocked by the buildings or ridge line you measured.', Eye],
];

const SCORE_TERMS = [
  ['Maximum elevation', 34],
  ['Illumination and brightness', 22],
  ['Duration above threshold', 20],
  ['Sky darkness and cloud', 14],
  ['Element-set confidence', 10],
];

export default function Landing() {
  const [mapMode, setMapMode] = useState('globe');

  const selection = useApi(() => tracking.defaultSelection(), []);
  const elementSets = useApi(
    () => tracking.elementSets(selection.data ?? []),
    [selection.data],
    { enabled: !!selection.data },
  );
  const nextLaunches = useApi(() => launchesApi.next(3), []);
  const weather = useApi(() => weatherApi.summary(), []);

  const { states, tracks } = useTracking(elementSets.data ?? [], null, { intervalMs: 400 });

  const mapSatellites = useMemo(
    () =>
      states
        .filter((s) => s.latitude !== undefined && !s.error)
        .map((s) => ({
          id: s.objectId,
          name: s.name,
          latitude: s.latitude,
          longitude: s.longitude,
          footprintAngleDeg: s.footprintAngleDeg,
          eclipsed: s.eclipsed,
        })),
    [states],
  );

  const mapTracks = useMemo(
    () => tracks.map((t) => ({ ...t, colour: '#4d9bff' })),
    [tracks],
  );

  const featured = states.find((s) => s.name?.startsWith('ISS')) ?? states[0];
  const sunlit = states.filter((s) => !s.eclipsed).length;

  return (
    <div className="space-y-20 pb-20">
      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="starfield absolute inset-0 bg-radial-fade" aria-hidden />
        <div className="absolute inset-0 bg-grid-faint bg-grid opacity-50" aria-hidden />

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-12 pt-14 sm:px-6 sm:pt-20">
          <div className="grid items-center grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="space-y-7">
              <Badge tone="primary" size="sm" dot>
                Front end build &middot; computing live from element sets
              </Badge>

              <div className="space-y-4">
                <h1 className="max-w-xl text-4xl font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-5xl">
                  Track what is overhead, and know how much to trust it.
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-ink-dim">
                  SpaceNova brings satellite tracking, observation planning, mission and launch
                  records, astronomy events, space weather and private research workspaces into one
                  platform. It propagates orbits itself with a documented, testable engine, and every
                  figure on screen carries its source, its age and its uncertainty.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Link to="/register">
                  <Button size="lg" variant="primary" iconRight={ArrowRight}>
                    Create an account
                  </Button>
                </Link>
                <Link to="/catalog">
                  <Button size="lg" variant="outline" icon={Satellite}>
                    Browse the catalogue
                  </Button>
                </Link>
              </div>

              <dl className="grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-6 sm:grid-cols-4">
                {[
                  ['Tracked now', num(states.length)],
                  ['Sunlit', num(sunlit)],
                  ['Refine step', '1 s'],
                  ['Score terms', '5'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="label-caps">{label}</dt>
                    <dd className="tnum mt-1 font-mono text-lg font-semibold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Live map. Not a screenshot: this is the real tracker component
                running the real propagation engine. */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Globe2 size={13} className="text-ink-faint" aria-hidden />
                  <span className="label-caps">Live propagation</span>
                </div>
                <SegmentedControl
                  size="sm"
                  ariaLabel="Map projection"
                  value={mapMode}
                  onChange={setMapMode}
                  options={[
                    { value: 'globe', label: 'Globe' },
                    { value: 'flat', label: 'Flat' },
                  ]}
                />
              </div>

              <WorldMap
                mode={mapMode}
                height={400}
                satellites={mapSatellites}
                tracks={mapTracks}
                showFootprints
                showLabels={false}
                className="shadow-panel"
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3 text-2xs text-ink-faint">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-primary" aria-hidden /> sunlit
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full border-[1.5px] border-primary" aria-hidden /> eclipsed
                  </span>
                  <span>drag to rotate, scroll to zoom</span>
                </div>
                {elementSets.meta && <SourceTag meta={elementSets.meta} compact />}
              </div>
            </div>
          </div>

          {/* Live readout for one object, so the hero carries real numbers. */}
          {featured && !featured.error && (
            <Panel className="mt-10">
              <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-6 lg:divide-x">
                <div className="flex items-center gap-3 p-4">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-base text-primary">
                    <Orbit size={16} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink">{featured.name}</p>
                    <p className="tnum font-mono text-2xs text-ink-faint">
                      NORAD {featured.noradId}
                    </p>
                  </div>
                </div>
                {[
                  ['Altitude', km(featured.altitudeKm, 1)],
                  ['Speed', kms(featured.speedKms)],
                  ['Latitude', `${num(featured.latitude, 2)}°`],
                  ['Longitude', `${num(featured.longitude, 2)}°`],
                  ['Footprint', km(featured.footprintRadiusKm, 0)],
                ].map(([label, value]) => (
                  <div key={label} className="p-4">
                    <p className="label-caps">{label}</p>
                    <p className="tnum mt-1 font-mono text-sm text-ink">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line bg-base/40 px-4 py-2.5">
                <OrbitBadge orbitClass={featured.orbitClass} />
                <EclipseBadge state={featured.eclipse?.state} />
                <Tag>period {num(featured.periodMinutes, 1)} min</Tag>
                <Tag>inclination {num(featured.inclination, 2)}&deg;</Tag>
                <span className="ml-auto inline-flex items-center gap-1.5 text-2xs text-ink-faint">
                  <Cpu size={11} aria-hidden />
                  Computed by SGP4, not a measurement
                </span>
              </div>
            </Panel>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------- capabilities */}
      <div className="mx-auto w-full max-w-7xl space-y-20 px-4 sm:px-6">
        <Section
          title="One platform, six working areas"
          description="Each area is a module of the specification, with its own requirements, screens and data sources. They share one catalogue, one engine and one set of thresholds."
        >
          <Grid cols={3}>
            {CAPABILITIES.map((item) => (
              <Panel key={item.title} className="h-full">
                <PanelBody className="space-y-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-base text-primary">
                    <item.icon size={16} aria-hidden />
                  </span>
                  <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-ink-faint">{item.body}</p>
                </PanelBody>
              </Panel>
            ))}
          </Grid>
        </Section>

        {/* ------------------------------------------------- how a pass works */}
        <Section
          title="How a pass is decided"
          description="Most trackers tell you an object will be above the horizon. That is not the same as being able to see it. SpaceNova evaluates four clauses separately and tells you which one failed."
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <Panel>
              <PanelHeader
                title="The four visibility clauses"
                subtitle="All four must hold. A pass that clears the elevation threshold but is blocked by your own horizon mask is reported as blocked, not as visible."
                icon={Eye}
              />
              <PanelBody padded={false}>
                <ol className="divide-y divide-line">
                  {CLAUSES.map(([title, body, Icon], i) => (
                    <li key={title} className="flex items-start gap-3.5 px-4 py-3.5">
                      <span className="tnum mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-base font-mono text-2xs text-ink-faint">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-ink">{title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-faint">{body}</p>
                      </div>
                      <Icon size={14} className="mt-1 shrink-0 text-ink-faint" aria-hidden />
                    </li>
                  ))}
                </ol>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                title="The quality score"
                subtitle="Five normalised terms with published weights. When the cloud forecast is missing the term is dropped and the rest are renormalised, rather than scoring the window as if the sky were clear."
                icon={TrendingUp}
              />
              <PanelBody className="space-y-3.5">
                {SCORE_TERMS.map(([label, weight]) => (
                  <div key={label} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-xs text-ink-dim">{label}</span>
                      <span className="tnum font-mono text-xs text-ink">{weight}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-overlay">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${weight * 2.6}%` }} />
                    </div>
                  </div>
                ))}
                <p className="border-t border-line pt-3 text-2xs leading-relaxed text-ink-faint">
                  Default weights, tuned against recorded observations. An administrator can change
                  them, and every window records the thresholds that produced it.
                </p>
              </PanelBody>
            </Panel>
          </div>
        </Section>

        {/* -------------------------------------------------------- live strip */}
        <Section
          title="Happening now"
          description="Pulled from the same endpoints the signed-in application uses."
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Panel>
              <PanelHeader
                title="Next launches"
                icon={Rocket}
                actions={nextLaunches.meta && <SourceTag meta={nextLaunches.meta} compact />}
              />
              <PanelBody padded={false}>
                <ul className="divide-y divide-line">
                  {(nextLaunches.data ?? []).map((launch) => (
                    <li key={launch.id}>
                      <Link
                        to={`/launches/${launch.id}`}
                        className="block px-4 py-3 transition-colors hover:bg-overlay/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-ink">{launch.payloadName}</p>
                            <p className="mt-0.5 truncate text-2xs text-ink-faint">
                              {launch.vehicle} &middot; {launch.provider}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="tnum font-mono text-2xs text-ink-dim">
                              {dateShort(launch.net)}
                            </p>
                            <p className="tnum font-mono text-2xs text-ink-faint">
                              {timeShort(launch.net)} UTC
                            </p>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                  {nextLaunches.loading && (
                    <li className="px-4 py-6 text-center text-2xs text-ink-faint">Loading schedule</li>
                  )}
                </ul>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                title="Space weather"
                icon={Sun}
                actions={weather.meta && <SourceTag meta={weather.meta} compact />}
              />
              <PanelBody className="space-y-3">
                {weather.data ? (
                  <>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="label-caps">Planetary K index</p>
                        <p className="tnum mt-1 font-mono text-2xl font-semibold text-ink">
                          {num(weather.data.kp, 1)}
                        </p>
                      </div>
                      <Badge tone={weather.data.kpBand.tone}>
                        {weather.data.kpBand.label}
                        {weather.data.kpBand.scale && <Tag>{weather.data.kpBand.scale}</Tag>}
                      </Badge>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3">
                      {[
                        ['Solar wind', `${num(weather.data.solarWindSpeedKms, 0)} km/s`],
                        ['Bz', `${num(weather.data.bzNt, 1)} nT`],
                        ['X-ray', weather.data.xrayClass.label],
                        ['Aurora chance', percent(weather.data.auroraProbability)],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-2xs text-ink-faint">{label}</dt>
                          <dd className="tnum font-mono text-xs text-ink">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="border-t border-line pt-2.5 text-2xs text-ink-faint">
                      The same indices scale the atmospheric density in the decay estimates.
                    </p>
                  </>
                ) : (
                  <p className="py-6 text-center text-2xs text-ink-faint">Loading conditions</p>
                )}
              </PanelBody>
            </Panel>

          </div>
        </Section>

        {/* -------------------------------------------------------------- roles */}
        <Section
          title="Five user classes"
          description="One role per account. Researcher and Engineer both build on the Observer role, and an administrator sets the role on an account."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {['guest', 'user', 'researcher', 'engineer', 'admin'].map((key) => {
              const role = ROLES[key];
              const Icon = {
                guest: Globe2,
                user: Binoculars,
                researcher: FlaskConical,
                engineer: Antenna,
                admin: ShieldCheck,
              }[key];
              return (
                <Panel key={key} className="h-full">
                  <PanelBody className="space-y-2.5">
                    <Icon size={16} className="text-primary" aria-hidden />
                    <h3 className="text-xs font-semibold text-ink">{role.label}</h3>
                    <p className="text-2xs leading-relaxed text-ink-faint">{role.description}</p>
                  </PanelBody>
                </Panel>
              );
            })}
          </div>
        </Section>

        {/* ---------------------------------------------------------- honesty */}
        <Section title="What this platform will not do">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {[
              [
                Database,
                'Present an estimate as a measurement',
                'Computed values are labelled computed. Magnitudes are labelled estimates with a stated uncertainty. Nothing on a telemetry panel is a fabricated subsystem reading.',
              ],
              [
                Signal,
                'Hide a stale or missing source',
                'Every panel shows its source and the age of the data. When a provider is unreachable, cached data is served with a visible banner naming the source and the age.',
              ],
              [
                ShieldCheck,
                'Claim operational accuracy',
                'Propagation from public element sets gives kilometre-scale accuracy that degrades with epoch age. No conjunction screening is performed and the platform is not for safety-critical use.',
              ],
            ].map(([Icon, title, body]) => (
              <Panel key={title} className="h-full">
                <PanelBody className="space-y-3">
                  <Icon size={16} className="text-warn" aria-hidden />
                  <h3 className="text-sm font-semibold text-ink">{title}</h3>
                  <p className="text-xs leading-relaxed text-ink-faint">{body}</p>
                </PanelBody>
              </Panel>
            ))}
          </div>
        </Section>

        {/* -------------------------------------------------------------- CTA */}
        <Panel className="relative overflow-hidden">
          <div className="starfield absolute inset-0 bg-radial-fade" aria-hidden />
          <PanelBody className="relative flex flex-col items-center gap-5 px-6 py-14 text-center">
            <h2 className="max-w-2xl text-2xl font-semibold tracking-[-0.02em] text-ink">
              Set a location, choose your objects, and get a ranked plan for tonight.
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-ink-dim">
              Observation planning takes a set of objects and a site, scans the horizon, refines
              every crossing to the second and ranks the windows. It takes about a minute to set up.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <Link to="/register">
                <Button size="lg" variant="primary" iconRight={ArrowRight}>
                  Create an account
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline">
                  Sign in
                </Button>
              </Link>
            </div>
            <p className="text-2xs text-ink-faint">
              {duration(60)} to set up &middot; no back end connected in this build
            </p>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}

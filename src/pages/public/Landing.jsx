import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Antenna, Binoculars, Blocks, CalendarRange, Compass, Cpu, Database,
  Eye, FlaskConical, Globe2, Moon, Orbit, Radar, Rocket, Satellite, ShieldCheck,
  Signal, Sun, TrendingUp,
} from 'lucide-react';
import { Button, Badge, Tag } from '../../components/ui/primitives.jsx';
import { Panel, PanelBody, PanelHeader, Section, Grid } from '../../components/ui/panel.jsx';
import { WorldMap } from '../../components/map/WorldMap.jsx';
import { SourceTag } from '../../components/data/source.jsx';
import { EclipseBadge, OrbitBadge } from '../../components/data/badges.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useTracking } from '../../hooks/useTracking.js';
import { tracking, launches as launchesApi, spaceWeather as weatherApi } from '../../api/index.js';
import { ROLES } from '../../mock/people.js';
import { km, kms, num, duration, dateShort, timeShort, percent } from '../../lib/format.js';

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

  // Tracks are drawn a step down from white so they read as part of the sky
  // rather than as lines laid across the headline.
  const mapTracks = useMemo(
    () => tracks.map((t) => ({ ...t, colour: '#8a8a93' })),
    [tracks],
  );

  const featured = states.find((s) => s.name?.startsWith('ISS')) ?? states[0];
  const sunlit = states.filter((s) => !s.eclipsed).length;

  return (
    <div>
      {/* ------------------------------------------------------------- hero */}
      {/*
        A full-viewport title card. There is no photograph to put here (the
        product ships no raster assets, on purpose), so the picture is the live
        globe: the real tracker component, running the real propagation engine,
        turning slowly behind the headline. Type sits straight on it with no
        scrim; the globe is drawn dark enough that it does not need one.
      */}
      <section className="relative isolate flex min-h-screen flex-col overflow-hidden bg-base">
        <div className="starfield absolute inset-0" aria-hidden />

        <div
          className="pointer-events-none absolute right-[-30vw] top-1/2 w-[min(120vw,1100px)] -translate-y-1/2 opacity-60 sm:right-[-18vw] sm:opacity-80 lg:right-[-10vw] lg:w-[min(76vw,1180px)] lg:opacity-100"
          aria-hidden
        >
          <WorldMap
            mode="globe"
            height={1180}
            satellites={mapSatellites}
            tracks={mapTracks}
            showFootprints={false}
            showLabels={false}
            interactive={false}
            autoRotate
            className="!rounded-none !border-0 !bg-transparent"
          />
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-end px-6 pb-10 pt-36 lg:px-8">
          <div className="max-w-4xl space-y-8">
            <p className="label-caps flex items-center gap-2.5 text-ink-dim">
              <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden />
              Front end build &middot; computing live from element sets
            </p>

            <h1 className="text-[2.5rem] leading-[0.95] sm:text-5xl md:text-[3.75rem] lg:text-display-xxl">
              Track what
              <br />
              is overhead
            </h1>

            <p className="max-w-xl text-[1rem] leading-[1.7] text-ink-dim">
              Know how much to trust it. SpaceNova brings satellite tracking, observation planning,
              mission and launch records, astronomy events, space weather and private research
              workspaces into one platform. It propagates orbits itself with a documented, testable
              engine, and every figure on screen carries its source, its age and its uncertainty.
            </p>

            <div>
              <Link to="/register">
                <Button size="lg" variant="outline" iconRight={ArrowRight}>
                  Create an account
                </Button>
              </Link>
            </div>
          </div>

          {/* Telemetry strip: real numbers from the same propagation loop. */}
          <div className="mt-14 space-y-6">
            <dl className="grid max-w-2xl grid-cols-2 gap-x-8 gap-y-5 border-t border-line-strong pt-6 sm:grid-cols-4">
              {[
                ['Tracked now', num(states.length)],
                ['Sunlit', num(sunlit)],
                ['Refine step', '1 s'],
                ['Score terms', '5'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="label-caps">{label}</dt>
                  <dd className="tnum mt-1.5 font-display text-3xl font-bold leading-none tracking-display text-ink">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {featured && !featured.error && (
              <Panel>
                <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-6 lg:divide-x">
                  <div className="flex items-center gap-3 p-4">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-card border border-line-strong text-ink">
                      <Orbit size={16} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-2xs font-bold uppercase tracking-micro text-ink">
                        {featured.name}
                      </p>
                      <p className="tnum font-mono text-2xs text-ink-faint">NORAD {featured.noradId}</p>
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
                <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
                  <OrbitBadge orbitClass={featured.orbitClass} />
                  <EclipseBadge state={featured.eclipse?.state} />
                  <Tag>period {num(featured.periodMinutes, 1)} min</Tag>
                  <Tag>inclination {num(featured.inclination, 2)}&deg;</Tag>
                  <span className="ml-auto inline-flex items-center gap-3">
                    {elementSets.meta && <SourceTag meta={elementSets.meta} compact />}
                    <span className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-micro text-ink-faint">
                      <Cpu size={11} aria-hidden />
                      Computed by SGP4, not a measurement
                    </span>
                  </span>
                </div>
              </Panel>
            )}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- capabilities */}
      <div className="mx-auto w-full max-w-7xl space-y-28 px-4 py-24 sm:px-6 lg:px-8">
        <Section
          large
          title="One platform, six working areas"
          description="Each area is a module of the specification, with its own requirements, screens and data sources. They share one catalogue, one engine and one set of thresholds."
        >
          <Grid cols={3}>
            {CAPABILITIES.map((item) => (
              <Panel key={item.title} className="h-full">
                <PanelBody className="space-y-4 p-5">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-card border border-line-strong text-ink">
                    <item.icon size={17} aria-hidden />
                  </span>
                  <h3 className="text-[0.8125rem] text-ink">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-ink-faint">{item.body}</p>
                </PanelBody>
              </Panel>
            ))}
          </Grid>
        </Section>

        {/* ------------------------------------------------- how a pass works */}
        <Section
          large
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
                    <li key={title} className="flex items-start gap-3.5 px-4 py-4">
                      <span className="tnum mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-2xs text-ink-dim">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-2xs font-bold uppercase tracking-micro text-ink">{title}</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{body}</p>
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
              <PanelBody className="space-y-4">
                {SCORE_TERMS.map(([label, weight]) => (
                  <div key={label} className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-xs text-ink-dim">{label}</span>
                      <span className="tnum font-mono text-xs text-ink">{weight}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-overlay">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${weight * 2.6}%` }} />
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
          large
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
                        className="block px-4 py-3.5 transition-colors hover:bg-overlay"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-ink">{launch.payloadName}</p>
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
                        <p className="tnum mt-1.5 font-display text-4xl font-bold leading-none tracking-display text-ink">
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
          large
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
                  <PanelBody className="space-y-3 p-5">
                    <Icon size={17} className="text-ink" aria-hidden />
                    <h3 className="text-[0.8125rem] text-ink">{role.label}</h3>
                    <p className="text-2xs leading-relaxed text-ink-faint">{role.description}</p>
                  </PanelBody>
                </Panel>
              );
            })}
          </div>
        </Section>

        {/* ---------------------------------------------------------- honesty */}
        <Section large title="What this platform will not do">
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
                <PanelBody className="space-y-4 p-5">
                  <Icon size={17} className="text-ink" aria-hidden />
                  <h3 className="text-[0.8125rem] text-ink">{title}</h3>
                  <p className="text-xs leading-relaxed text-ink-faint">{body}</p>
                </PanelBody>
              </Panel>
            ))}
          </div>
        </Section>
      </div>

      {/* -------------------------------------------------------------- CTA */}
      <section className="relative overflow-hidden border-t border-line-strong">
        <div className="starfield absolute inset-0" aria-hidden />
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-8 px-6 py-28 text-center">
          <h2 className="text-[2rem] leading-[1.15] sm:text-display-lg">
            Set a location, choose your objects, and get a ranked plan for tonight.
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-ink-dim sm:text-[1rem]">
            Observation planning takes a set of objects and a site, scans the horizon, refines
            every crossing to the second and ranks the windows. It takes about a minute to set up.
          </p>
          <div className="flex flex-col items-center gap-5">
            <Link to="/register">
              <Button size="lg" variant="outline" iconRight={ArrowRight}>
                Create an account
              </Button>
            </Link>
            <Link to="/login" className="link text-[0.8125rem] font-bold uppercase tracking-cap">
              Sign in
            </Link>
          </div>
          <p className="text-2xs uppercase tracking-micro text-ink-faint">
            {duration(60)} to set up &middot; no back end connected in this build
          </p>
        </div>
      </section>
    </div>
  );
}

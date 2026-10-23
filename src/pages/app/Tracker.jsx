import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, Binoculars, Compass, Globe2, Layers, Map as MapIcon, Plus, Radar, Satellite, X,
} from 'lucide-react';
import { Grid, KeyValue, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, StatTile } from '../../components/ui/panel.jsx';
import { DataTable } from '../../components/ui/table.jsx';
import { SegmentedControl } from '../../components/ui/nav.jsx';
import { Badge, Button, IconButton, Tag } from '../../components/ui/primitives.jsx';
import { Checkbox, SearchInput } from '../../components/ui/form.jsx';
import { Banner, EmptyState, InlineNote, LoadingState } from '../../components/ui/feedback.jsx';
import { Drawer } from '../../components/ui/overlay.jsx';
import { WorldMap } from '../../components/map/WorldMap.jsx';
import { ComputedNotice, SourceTag } from '../../components/data/source.jsx';
import { EclipseBadge, FreshnessBadge, OrbitBadge } from '../../components/data/badges.jsx';
import { useApi, useDebounced, useLocalState } from '../../hooks/useApi.js';
import { useTracking } from '../../hooks/useTracking.js';
import { catalog, plans as plansApi, tracking } from '../../api/index.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { compass, deg, hz, km, kms, latLon, num } from '../../lib/format.js';

const TRACK_COLOURS = ['#ffffff', '#3fd49b', '#e8ac4a', '#d2d2e6', '#f0706f', '#f0f0fa', '#86868f', '#3fd49b'];

export default function Tracker() {
  const [params, setParams] = useSearchParams();
  const { activeLocation, observer, preferences, setPreference } = useSettings();

  const [selectedIds, setSelectedIds] = useLocalState('spacenova.trackerSelection', null);
  const [focusId, setFocusId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);

  const defaults = useApi(() => tracking.defaultSelection(), []);
  const planList = useApi(() => plansApi.list(), []);
  const suggestions = useApi(() => catalog.suggest(debounced, 24), [debounced], {
    enabled: pickerOpen,
  });

  // A link from the catalogue can preselect an object.
  useEffect(() => {
    const fromUrl = params.get('objects');
    if (fromUrl) {
      const ids = fromUrl.split(',').filter(Boolean);
      setSelectedIds(ids);
      setFocusId(ids[0]);
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedIds === null && defaults.data) setSelectedIds(defaults.data);
  }, [defaults.data, selectedIds, setSelectedIds]);

  const ids = selectedIds ?? [];
  const elementSets = useApi(() => tracking.elementSets(ids), [ids.join(',')], {
    enabled: ids.length > 0,
  });

  const { states, tracks, at } = useTracking(elementSets.data ?? [], observer, {
    intervalMs: 300,
    minElevationDeg: activeLocation?.minElevationDeg ?? 10,
  });

  const colourFor = useMemo(() => {
    const map = new Map();
    ids.forEach((id, i) => map.set(id, TRACK_COLOURS[i % TRACK_COLOURS.length]));
    return map;
  }, [ids]);

  const focused = states.find((s) => s.objectId === focusId) ?? null;
  const aboveHorizon = states.filter((s) => s.aboveHorizon);
  const sunlit = states.filter((s) => !s.eclipsed && !s.error);

  const toggleObject = (id) => {
    setSelectedIds((current) => {
      const list = current ?? [];
      return list.includes(id) ? list.filter((v) => v !== id) : [...list, id];
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Radar}
        title="Live tracker"
        description="Positions, ground tracks and footprints computed in this browser from the cached element sets. The server is asked only for element sets, never for positions."
        meta={
          <>
            <Tag>{ids.length} objects</Tag>
            <Tag>updating 3 times a second</Tag>
            {activeLocation && <Tag>look angles from {activeLocation.name}</Tag>}
            {elementSets.meta && <SourceTag meta={elementSets.meta} />}
          </>
        }
        actions={
          <>
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setPickerOpen(true)}>
              Choose objects
            </Button>
            <SegmentedControl
              ariaLabel="Map projection"
              value={preferences.mapMode}
              onChange={(v) => setPreference('mapMode', v)}
              options={[
                { value: 'flat', label: 'Flat', icon: MapIcon },
                { value: 'globe', label: 'Globe', icon: Globe2 },
              ]}
            />
          </>
        }
      />

      <Grid cols={4}>
        <StatTile label="Tracked" value={num(states.length)} icon={Satellite} hint="Objects in this view" />
        <StatTile
          label="Above the horizon"
          value={num(aboveHorizon.length)}
          tone={aboveHorizon.length ? 'good' : 'default'}
          icon={Binoculars}
          hint={activeLocation ? `From ${activeLocation.name}` : 'No observer location set'}
        />
        <StatTile label="Sunlit" value={num(sunlit.length)} hint="Outside the Earth shadow cone" />
        <StatTile
          label="Clock"
          value={at.toISOString().slice(11, 19)}
          unit="UTC"
          hint="Every position on this page is for this instant"
        />
      </Grid>

      {ids.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Satellite}
            title="Nothing selected"
            description="Choose objects from the catalogue, or take them from a saved observation plan."
            action={
              <Button size="sm" variant="primary" icon={Plus} onClick={() => setPickerOpen(true)}>
                Choose objects
              </Button>
            }
          />
        </Panel>
      ) : elementSets.loading && !elementSets.data ? (
        <Panel>
          <LoadingState label="Loading element sets" />
        </Panel>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-3">
            <WorldMap
              mode={preferences.mapMode}
              height={480}
              satellites={states
                .filter((s) => !s.error)
                .map((s) => ({
                  id: s.objectId,
                  name: s.name,
                  latitude: s.latitude,
                  longitude: s.longitude,
                  footprintAngleDeg: s.footprintAngleDeg,
                  eclipsed: s.eclipsed,
                  colour: colourFor.get(s.objectId),
                }))}
              tracks={tracks.map((t) => ({ ...t, colour: colourFor.get(t.id) }))}
              observer={observer ? { ...observer, name: activeLocation?.name } : undefined}
              selectedId={focusId}
              onSelect={setFocusId}
              showTerminator={preferences.showTerminator}
              showGraticule={preferences.showGraticule}
              showFootprints={preferences.showFootprints}
              showLabels={preferences.showLabels}
            />

            <Panel>
              <PanelHeader title="Layers" icon={Layers} />
              <PanelBody className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <Checkbox
                  checked={preferences.showTerminator}
                  onChange={(v) => setPreference('showTerminator', v)}
                  label="Day and night"
                  description="Shades the hemisphere where the Sun is below the horizon."
                />
                <Checkbox
                  checked={preferences.showFootprints}
                  onChange={(v) => setPreference('showFootprints', v)}
                  label="Footprints"
                  description="Circle inside which the object clears the minimum elevation."
                />
                <Checkbox
                  checked={preferences.showGraticule}
                  onChange={(v) => setPreference('showGraticule', v)}
                  label="Graticule"
                  description="Ten degree parallels and meridians."
                />
                <Checkbox
                  checked={preferences.showLabels}
                  onChange={(v) => setPreference('showLabels', v)}
                  label="Labels"
                  description="Object names beside each marker."
                />
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                title="Tracked objects"
                subtitle="Click a row to focus it on the map."
                icon={Satellite}
                actions={<SourceTag meta={{ kind: 'computed', sourceLabel: 'Propagation engine', retrievedAt: at.toISOString() }} compact />}
              />
              <DataTable
                dense
                onRowClick={(row) => setFocusId(row.objectId)}
                rowKey={(row) => row.objectId}
                columns={[
                  {
                    key: 'name',
                    header: 'Object',
                    nowrap: false,
                    render: (s) => (
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: colourFor.get(s.objectId) }}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="truncate text-ink">{s.name}</p>
                          <p className="tnum truncate font-mono text-2xs text-ink-faint">{s.noradId}</p>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'latitude',
                    header: 'Sub-point',
                    mono: true,
                    hideBelow: 'md',
                    render: (s) => (s.error ? '--' : latLon(s.latitude, s.longitude, 1)),
                  },
                  {
                    key: 'altitudeKm',
                    header: 'Altitude',
                    align: 'right',
                    mono: true,
                    render: (s) => (s.error ? '--' : km(s.altitudeKm, 0)),
                  },
                  {
                    key: 'speedKms',
                    header: 'Speed',
                    align: 'right',
                    mono: true,
                    hideBelow: 'lg',
                    render: (s) => (s.error ? '--' : kms(s.speedKms)),
                  },
                  {
                    key: 'elevation',
                    header: 'Elevation',
                    align: 'right',
                    mono: true,
                    render: (s) =>
                      s.elevation === null || s.error ? (
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
                    hideBelow: 'lg',
                    render: (s) => (s.azimuth === null || s.error ? '--' : `${compass(s.azimuth)} ${deg(s.azimuth, 0)}`),
                  },
                  {
                    key: 'eclipse',
                    header: 'Light',
                    hideBelow: 'xl',
                    render: (s) => (s.error ? <Badge tone="bad" size="sm">Error</Badge> : <EclipseBadge state={s.eclipse.state} />),
                  },
                  {
                    key: 'remove',
                    header: '',
                    align: 'right',
                    render: (s) => (
                      <IconButton
                        icon={X}
                        label={`Stop tracking ${s.name}`}
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleObject(s.objectId);
                          if (focusId === s.objectId) setFocusId(null);
                        }}
                      />
                    ),
                  },
                ]}
                rows={states}
              />
            </Panel>
          </div>

          {/* ------------------------------------------------- focus panel */}
          <div className="space-y-3">
            {focused && !focused.error ? (
              <>
                <Panel>
                  <PanelHeader
                    title={focused.name}
                    subtitle={`${focused.categoryLabel} · NORAD ${focused.noradId}`}
                    icon={Satellite}
                    actions={<FreshnessBadge freshness={focused.freshness} />}
                  />
                  <PanelBody className="space-y-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <OrbitBadge orbitClass={focused.orbitClass} />
                      <EclipseBadge state={focused.eclipse.state} />
                      {focused.aboveHorizon && (
                        <Badge tone="good" size="sm" icon={Binoculars}>
                          Above the horizon
                        </Badge>
                      )}
                    </div>
                    <KeyValue
                      dense
                      rows={[
                        { label: 'Sub-satellite point', value: latLon(focused.latitude, focused.longitude, 3) },
                        { label: 'Altitude', value: km(focused.altitudeKm, 1) },
                        { label: 'Speed', value: kms(focused.speedKms, 3) },
                        { label: 'Footprint radius', value: km(focused.footprintRadiusKm, 0) },
                        { label: 'Orbital period', value: `${num(focused.periodMinutes, 2)} min` },
                        { label: 'Inclination', value: deg(focused.inclination, 3) },
                        { label: 'Apogee', value: km(focused.apogeeKm, 0) },
                        { label: 'Perigee', value: km(focused.perigeeKm, 0) },
                      ]}
                    />
                  </PanelBody>
                  <PanelFooter>
                    <Link to={`/catalog/${focused.objectId}`} className="link inline-flex items-center gap-1 text-2xs">
                      Catalogue record
                      <ArrowRight size={11} aria-hidden />
                    </Link>
                  </PanelFooter>
                </Panel>

                <Panel>
                  <PanelHeader
                    title="From your location"
                    subtitle={activeLocation?.name ?? 'No observer location set'}
                    icon={Compass}
                  />
                  <PanelBody>
                    {observer ? (
                      <KeyValue
                        dense
                        rows={[
                          {
                            label: 'Elevation',
                            value: focused.elevation === null ? '--' : deg(focused.elevation, 2),
                            className: focused.aboveHorizon ? 'text-good' : undefined,
                          },
                          {
                            label: 'Azimuth',
                            value:
                              focused.azimuth === null
                                ? '--'
                                : `${deg(focused.azimuth, 2)} (${compass(focused.azimuth)})`,
                          },
                          { label: 'Slant range', value: focused.rangeKm === null ? '--' : km(focused.rangeKm, 0) },
                          {
                            label: 'Range rate',
                            value: focused.rangeRateKms === null ? '--' : kms(focused.rangeRateKms, 3),
                          },
                          {
                            label: 'Doppler shift',
                            value:
                              focused.dopplerHz === null
                                ? 'no published downlink'
                                : `${num(focused.dopplerHz / 1000, 2)} kHz`,
                          },
                          {
                            label: 'Downlink assumed',
                            value: focused.downlinkHz ? hz(focused.downlinkHz) : '--',
                          },
                        ]}
                      />
                    ) : (
                      <InlineNote>
                        Look angles need an observer position. Add one from the locations screen.
                      </InlineNote>
                    )}
                  </PanelBody>
                </Panel>

                <ComputedNotice />
              </>
            ) : (
              <Panel>
                <EmptyState
                  compact
                  icon={Compass}
                  title="No object focused"
                  description="Click a marker on the map, or a row in the table, to see its live state and look angles."
                />
              </Panel>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------ object picker */}
      <Drawer
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Choose objects to track"
        description="Take the objects from a saved plan, or search the whole catalogue."
        width="w-[30rem]"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
              Clear all
            </Button>
            <Button size="sm" variant="primary" onClick={() => setPickerOpen(false)}>
              Done, {ids.length} selected
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {(planList.data ?? []).length > 0 && (
            <section className="space-y-2.5">
              <p className="label-caps">From a saved plan</p>
              {(planList.data ?? []).map((plan) => {
                const planObjects = plan.objectIds ?? [];
                const allSelected =
                  planObjects.length > 0 && planObjects.every((id) => ids.includes(id));
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
                        setSelectedIds((current) => {
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
            <SearchInput value={query} onChange={setQuery} placeholder="Name or catalogue number" autoFocus />
            <ul className="space-y-1">
              {(suggestions.data ?? []).map((row) => {
                const selected = ids.includes(row.id);
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
                        {selected ? <X size={13} className="text-ink-faint" aria-hidden /> : <Plus size={13} className="text-ink-faint" aria-hidden />}
                      </div>
                    </button>
                  </li>
                );
              })}
              {suggestions.loading && <li className="py-3 text-center text-2xs text-ink-faint">Searching</li>}
            </ul>
          </section>

          <Banner tone="info" compact title="Why a limit matters">
            Each object is propagated independently several times a second. Twenty or so is
            comfortable on a laptop; beyond that the ground tracks dominate the frame budget.
          </Banner>
        </div>
      </Drawer>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, MapPin, Package, Rocket, Timer } from 'lucide-react';
import { Grid, PageHeader, Panel, PanelBody, PanelHeader, StatTile } from '../../components/ui/panel.jsx';
import { DataTable, FilterChips, Pagination, Toolbar } from '../../components/ui/table.jsx';
import { SearchInput } from '../../components/ui/form.jsx';
import { SegmentedControl } from '../../components/ui/nav.jsx';
import { Badge, Tag } from '../../components/ui/primitives.jsx';
import { ErrorState } from '../../components/ui/feedback.jsx';
import { FixtureNotice, SourceTag } from '../../components/data/source.jsx';
import { WorldMap } from '../../components/map/WorldMap.jsx';
import { useApi, useClock, useDebounced } from '../../hooks/useApi.js';
import { launches as launchesApi } from '../../api/index.js';
import { age, dateShort, duration, num, timeShort, titleCase } from '../../lib/format.js';

export default function Launches() {
  const navigate = useNavigate();
  const now = useClock(1000);
  const [view, setView] = useState('upcoming');
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const [provider, setProvider] = useState([]);
  const [page, setPage] = useState(1);

  const request = useMemo(
    () => ({
      q: debounced,
      provider,
      upcoming: view === 'all' ? undefined : view === 'upcoming',
      sort: 'net',
      direction: view === 'past' ? 'desc' : 'asc',
      page,
      pageSize: 20,
    }),
    [debounced, provider, view, page],
  );

  const { data, meta, loading, error, reload } = useApi(() => launchesApi.list(request), [request]);
  const next = useApi(() => launchesApi.next(1), []);
  const upcomingNext = next.data?.[0];

  const pads = useMemo(
    () =>
      (data?.rows ?? []).map((l) => ({
        id: l.id,
        latitude: l.padLatitude,
        longitude: l.padLongitude,
        name: l.padName,
      })),
    [data],
  );

  const countdown = upcomingNext
    ? Math.max(0, (new Date(upcomingNext.net).getTime() - now.getTime()) / 1000)
    : null;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Rocket}
        title="Launch schedule"
        description="Upcoming windows with their status and confidence, and the outcome of recent flights. Dates marked to be confirmed have no committed window yet."
        meta={meta ? <SourceTag meta={meta} showStamp /> : null}
      />

      <FixtureNotice>
        The launch schedule is fixture data in Phase 1. In Phase 2 it is read from the launch
        provider listed in the specification, cached with a one hour time to live, and served from
        cache with a staleness banner whenever the provider is unreachable.
      </FixtureNotice>

      <Grid cols={4}>
        <StatTile
          label="Next launch"
          value={countdown === null ? '--' : duration(countdown)}
          hint={upcomingNext ? `${upcomingNext.vehicle}, ${upcomingNext.payloadName}` : 'No upcoming window'}
          icon={Timer}
          tone="primary"
        />
        <StatTile
          label="Upcoming"
          value={num((data?.rows ?? []).filter((l) => l.upcoming).length || data?.total || 0)}
          hint="Windows in the schedule"
          icon={CalendarClock}
        />
        <StatTile
          label="Providers"
          value={num((meta?.providers ?? []).length)}
          hint="Distinct launch providers"
          icon={Package}
        />
        <StatTile
          label="Pads represented"
          value={num(new Set(pads.map((p) => p.name)).size)}
          hint="On the map below"
          icon={MapPin}
        />
      </Grid>

      {pads.length > 0 && (
        <Panel>
          <PanelHeader
            title="Launch sites in this view"
            subtitle="Each marker is a pad with a window in the current filter."
            icon={MapPin}
          />
          <PanelBody padded={false}>
            <WorldMap mode="flat" height={260} pads={pads} showFootprints={false} showLabels={false} interactive={false} />
          </PanelBody>
        </Panel>
      )}

      <Panel>
        <Toolbar
          right={
            <SegmentedControl
              size="sm"
              ariaLabel="Which launches"
              value={view}
              onChange={(v) => {
                setView(v);
                setPage(1);
              }}
              options={[
                { value: 'upcoming', label: 'Upcoming' },
                { value: 'past', label: 'Past' },
                { value: 'all', label: 'All' },
              ]}
            />
          }
        >
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Search payload, vehicle, provider or pad"
            className="w-full max-w-sm"
          />
        </Toolbar>

        {meta?.providers && (
          <div className="border-b border-line px-4 py-3">
            <FilterChips
              label="Provider"
              options={meta.providers.map((p) => ({ value: p, label: p }))}
              selected={provider}
              onToggle={(value) => {
                setPage(1);
                setProvider((list) =>
                  list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
                );
              }}
            />
          </div>
        )}

        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <>
            <DataTable
              loading={loading}
              onRowClick={(row) => navigate(`/launches/${row.id}`)}
              columns={[
                {
                  key: 'net',
                  header: 'Window (UTC)',
                  render: (row) => (
                    <div>
                      <p className="tnum font-mono text-ink">
                        {dateShort(row.net)} {timeShort(row.net)}
                      </p>
                      <p className="text-2xs text-ink-faint">
                        {row.upcoming ? age(row.net) : age(row.net)}
                        {row.windowMinutes ? ` · ${row.windowMinutes} min window` : ' · instantaneous'}
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'payloadName',
                  header: 'Payload',
                  nowrap: false,
                  render: (row) => (
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{row.payloadName}</p>
                      <p className="truncate text-2xs text-ink-faint">{titleCase(row.payloadKind)}</p>
                    </div>
                  ),
                },
                {
                  key: 'vehicle',
                  header: 'Vehicle',
                  hideBelow: 'md',
                  render: (row) => (
                    <div className="min-w-0">
                      <p className="truncate text-ink-dim">{row.vehicle}</p>
                      <p className="truncate text-2xs text-ink-faint">{row.provider}</p>
                    </div>
                  ),
                },
                {
                  key: 'padName',
                  header: 'Pad',
                  hideBelow: 'lg',
                  render: (row) => (
                    <div className="min-w-0">
                      <p className="truncate text-ink-dim">{row.padName}</p>
                      <p className="truncate text-2xs text-ink-faint">{row.padLocation}</p>
                    </div>
                  ),
                },
                {
                  key: 'destination',
                  header: 'Destination',
                  hideBelow: 'xl',
                  render: (row) => <Tag>{row.destination}</Tag>,
                },
                {
                  key: 'statusKey',
                  header: 'Status',
                  render: (row) => (
                    <div className="flex items-center gap-2">
                      <Badge tone={row.statusTone} size="sm" dot>
                        {row.statusLabel}
                      </Badge>
                      {row.probability !== null && (
                        <span className="tnum font-mono text-2xs text-ink-faint">{row.probability}%</span>
                      )}
                    </div>
                  ),
                },
              ]}
              rows={data?.rows ?? []}
            />
            <Pagination
              page={data?.page ?? 1}
              pages={data?.pages ?? 1}
              total={data?.total ?? 0}
              from={data?.from ?? 0}
              to={data?.to ?? 0}
              onPage={setPage}
              unit="launches"
            />
          </>
        )}
      </Panel>
    </div>
  );
}

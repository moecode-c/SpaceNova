import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Gauge, Sun, TrendingDown } from 'lucide-react';
import { Grid, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, StatTile } from '../../components/ui/panel.jsx';
import { DataTable, FilterChips, Pagination, Toolbar } from '../../components/ui/table.jsx';
import { SearchInput } from '../../components/ui/form.jsx';
import { Badge, Tag } from '../../components/ui/primitives.jsx';
import { Banner, EmptyState, InlineNote } from '../../components/ui/feedback.jsx';
import { SourceTag } from '../../components/data/source.jsx';
import { FreshnessBadge } from '../../components/data/badges.jsx';
import { useApi, useDebounced } from '../../hooks/useApi.js';
import { engineering } from '../../api/index.js';
import { dateShort, km, num } from '../../lib/format.js';

const STATUSES = [
  { value: 'imminent', label: 'Imminent' },
  { value: 'decaying', label: 'Decaying' },
  { value: 'stable', label: 'Stable' },
];

const STATUS_TONE = { imminent: 'bad', decaying: 'warn', stable: 'good' };

export default function DecayWatch() {
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const [status, setStatus] = useState([]);
  const [page, setPage] = useState(1);

  const request = useMemo(
    () => ({ q: debounced, status, page, pageSize: 20, sort: 'perigeeKm', direction: 'asc' }),
    [debounced, status, page],
  );
  const { data, meta, loading } = useApi(() => engineering.decay(request), [request]);

  const rows = data?.rows ?? [];
  const imminent = rows.filter((r) => r.status === 'imminent');

  return (
    <div className="space-y-5">
      <PageHeader
        icon={TrendingDown}
        title="Decay watch"
        description="Estimated remaining lifetime for low Earth orbit objects, from the perigee altitude, the drag term in the element set, and current solar and geomagnetic activity."
        meta={
          <>
            {data && (
              <>
                <Tag>F10.7 {num(data.activity.f107, 0)}</Tag>
                <Tag>Kp {num(data.activity.kp, 1)}</Tag>
              </>
            )}
            {meta && <SourceTag meta={meta} />}
          </>
        }
      />

      <Banner tone="warn" title="Estimate only" icon={AlertTriangle}>
        {data?.disclaimer}
      </Banner>

      <Grid cols={4}>
        <StatTile
          label="Objects watched"
          value={num(data?.total ?? 0)}
          hint="Low Earth orbit only"
          icon={TrendingDown}
        />
        <StatTile
          label="Imminent"
          value={num(imminent.length)}
          tone={imminent.length ? 'bad' : 'default'}
          hint="Estimated window inside 30 days"
        />
        <StatTile
          label="Solar flux"
          value={num(data?.activity.f107 ?? 0, 0)}
          unit="sfu"
          hint="Higher flux expands the thermosphere and raises drag"
          icon={Sun}
        />
        <StatTile
          label="Geomagnetic activity"
          value={num(data?.activity.kp ?? 0, 1)}
          hint="Kp raises the density at a given altitude during a storm"
          icon={Gauge}
        />
      </Grid>

      <Panel>
        <Toolbar>
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Search object or category"
            className="w-full max-w-sm"
          />
          <FilterChips
            label="Status"
            options={STATUSES}
            selected={status}
            onToggle={(value) => {
              setPage(1);
              setStatus((list) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]));
            }}
          />
        </Toolbar>

        <DataTable
          loading={loading}
          rowKey={(r) => r.objectId}
          columns={[
            {
              key: 'name',
              header: 'Object',
              nowrap: false,
              render: (r) => (
                <div className="min-w-0">
                  <Link to={`/catalog/${r.objectId}`} className="truncate font-medium text-ink hover:text-primary-bright">
                    {r.name}
                  </Link>
                  <p className="truncate text-2xs text-ink-faint">{r.categoryLabel}</p>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (r) => (
                <Badge tone={STATUS_TONE[r.status]} size="sm" dot>
                  {r.status}
                </Badge>
              ),
            },
            { key: 'perigeeKm', header: 'Perigee', align: 'right', mono: true, render: (r) => km(r.perigeeKm, 1) },
            { key: 'apogeeKm', header: 'Apogee', align: 'right', mono: true, hideBelow: 'md', render: (r) => km(r.apogeeKm, 1) },
            {
              key: 'altitudeLossKmPerDay',
              header: 'Altitude loss',
              align: 'right',
              mono: true,
              hideBelow: 'lg',
              render: (r) =>
                r.altitudeLossKmPerDay > 0 ? `${num(r.altitudeLossKmPerDay, 3)} km/day` : <span className="text-ink-faint">negligible</span>,
            },
            {
              key: 'lifetimeDays',
              header: 'Estimated lifetime',
              align: 'right',
              mono: true,
              render: (r) =>
                r.lifetimeDays === null ? (
                  <span className="text-ink-faint">&gt; 10 years</span>
                ) : (
                  <span className={r.status === 'imminent' ? 'text-bad' : undefined}>
                    {num(r.lifetimeDays, r.lifetimeDays < 30 ? 1 : 0)} d
                  </span>
                ),
            },
            {
              key: 'window',
              header: 'Re-entry window',
              hideBelow: 'lg',
              render: (r) =>
                r.windowStart ? (
                  <span className="tnum font-mono text-2xs">
                    {dateShort(r.windowStart)} &ndash; {dateShort(r.windowEnd)}
                  </span>
                ) : (
                  <span className="text-ink-faint">not applicable</span>
                ),
            },
            {
              key: 'bstar',
              header: 'B*',
              align: 'right',
              mono: true,
              hideBelow: 'xl',
              render: (r) => r.bstar.toExponential(2),
            },
            {
              key: 'freshness',
              header: 'Element set',
              hideBelow: 'xl',
              render: (r) => <FreshnessBadge freshness={r.freshness} showAge={false} />,
            },
          ]}
          rows={rows}
          empty={
            <EmptyState
              icon={TrendingDown}
              title="Nothing matches"
              description="No low Earth orbit object in the catalogue matches these filters."
            />
          }
        />
        <Pagination
          page={data?.page ?? 1}
          pages={data?.pages ?? 1}
          total={data?.total ?? 0}
          from={data?.from ?? 0}
          to={data?.to ?? 0}
          onPage={setPage}
          unit="objects"
        />
      </Panel>

      <Panel>
        <PanelHeader title="How the estimate is formed" icon={TrendingDown} />
        <PanelBody className="space-y-2.5">
          <InlineNote>
            An exponential atmosphere is scaled by the current solar flux and geomagnetic index,
            and applied to the drag term carried in the element set. The resulting altitude loss
            per day is projected forward with an allowance for the acceleration that happens as the
            orbit tightens.
          </InlineNote>
          <InlineNote>
            The answer is reported as a window rather than a date, because the dominant uncertainty
            is future solar activity, which nobody can predict beyond a few days. The window widens
            with the horizon.
          </InlineNote>
          <InlineNote>
            Above roughly 700 km the drag is negligible on any horizon this product discusses, so
            such objects are reported as stable rather than being given a misleadingly precise
            large number.
          </InlineNote>
        </PanelBody>
        <PanelFooter>
          <span className="text-2xs text-ink-faint">
            No conjunction screening or collision assessment is performed anywhere in this platform.
          </span>
        </PanelFooter>
      </Panel>
    </div>
  );
}

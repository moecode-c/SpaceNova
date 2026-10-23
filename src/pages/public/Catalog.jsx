import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Database, Filter, RotateCcw, Satellite } from 'lucide-react';
import { PageHeader, Panel, PanelBody, Grid, StatTile } from '../../components/ui/panel.jsx';
import { DataTable, Pagination, Toolbar, FilterChips } from '../../components/ui/table.jsx';
import { SearchInput, Select } from '../../components/ui/form.jsx';
import { Button } from '../../components/ui/primitives.jsx';
import { ErrorState } from '../../components/ui/feedback.jsx';
import { FixtureNotice, SourceTag } from '../../components/data/source.jsx';
import { FreshnessBadge, OrbitBadge, StatusBadge } from '../../components/data/badges.jsx';
import { useApi, useDebounced } from '../../hooks/useApi.js';
import { catalog } from '../../api/index.js';
import { CATEGORY_LABELS } from '../../mock/seed-objects.js';
import { km, num, titleCase } from '../../lib/format.js';

const SORTS = [
  ['name', 'Name'],
  ['noradId', 'Catalogue number'],
  ['perigeeKm', 'Perigee altitude'],
  ['apogeeKm', 'Apogee altitude'],
  ['inclination', 'Inclination'],
  ['periodMinutes', 'Orbital period'],
  ['standardMagnitude', 'Standard magnitude'],
  ['launchDate', 'Launch date'],
];

export default function Catalog() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState(params.get('q') ?? '');
  const debounced = useDebounced(query, 250);
  const [category, setCategory] = useState([]);
  const [orbitClass, setOrbitClass] = useState([]);
  const [type, setType] = useState([]);
  const [sort, setSort] = useState('name');
  const [direction, setDirection] = useState('asc');
  const [page, setPage] = useState(1);

  const request = useMemo(
    () => ({ q: debounced, category, orbitClass, type, sort, direction, page, pageSize: 20 }),
    [debounced, category, orbitClass, type, sort, direction, page],
  );

  const { data, meta, loading, error, reload } = useApi(() => catalog.list(request), [request]);

  const facets = meta?.facets;
  const activeFilters = category.length + orbitClass.length + type.length;

  const toggle = (setter) => (value) => {
    setPage(1);
    setter((list) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]));
  };

  const onSort = (key) => {
    if (sort === key) setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setDirection(key === 'name' || key === 'launchDate' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const reset = () => {
    setCategory([]);
    setOrbitClass([]);
    setType([]);
    setQuery('');
    setPage(1);
    setParams({});
  };

  const columns = [
    {
      key: 'name',
      header: 'Object',
      sortable: true,
      nowrap: false,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.name}</p>
          <p className="tnum truncate font-mono text-2xs text-ink-faint">
            {row.noradId} &middot; {row.intlDes}
          </p>
        </div>
      ),
    },
    {
      key: 'categoryLabel',
      header: 'Category',
      sortable: true,
      hideBelow: 'md',
      render: (row) => <span className="text-ink-dim">{row.categoryLabel}</span>,
    },
    {
      key: 'orbitClass',
      header: 'Orbit',
      sortable: true,
      render: (row) => <OrbitBadge orbitClass={row.orbitClass} />,
    },
    {
      key: 'perigeeKm',
      header: 'Perigee',
      align: 'right',
      mono: true,
      sortable: true,
      hideBelow: 'md',
      render: (row) => km(row.perigeeKm, 0),
    },
    {
      key: 'apogeeKm',
      header: 'Apogee',
      align: 'right',
      mono: true,
      sortable: true,
      hideBelow: 'lg',
      render: (row) => km(row.apogeeKm, 0),
    },
    {
      key: 'inclination',
      header: 'Inclination',
      align: 'right',
      mono: true,
      sortable: true,
      hideBelow: 'lg',
      render: (row) => `${num(row.inclination, 2)}°`,
    },
    {
      key: 'periodMinutes',
      header: 'Period',
      align: 'right',
      mono: true,
      sortable: true,
      hideBelow: 'xl',
      render: (row) => `${num(row.periodMinutes, 1)} min`,
    },
    {
      key: 'freshness',
      header: 'Element set',
      render: (row) => <FreshnessBadge freshness={row.freshness} />,
    },
    {
      key: 'status',
      header: 'Status',
      hideBelow: 'xl',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Satellite}
        title="Object catalogue"
        description="Every tracked object with its orbit geometry, its latest element set and the freshness band that governs how far it can be propagated."
        meta={meta ? <SourceTag meta={meta} showStamp /> : null}
      />

      <FixtureNotice>{meta?.fixtureNotice}</FixtureNotice>

      {facets && (
        <Grid cols={4}>
          <StatTile
            label="Objects"
            value={num(data?.total ?? 0)}
            hint={activeFilters > 0 || debounced ? 'Matching the current filters' : 'In the catalogue'}
            icon={Database}
          />
          <StatTile
            label="Low Earth orbit"
            value={num(facets.orbitClass.LEO ?? 0)}
            hint="Below 2 000 km apogee"
          />
          <StatTile
            label="Payloads"
            value={num(facets.type.payload ?? 0)}
            hint={`${num(facets.type['rocket-body'] ?? 0)} rocket bodies, ${num(facets.type.debris ?? 0)} debris`}
          />
          <StatTile
            label="Operators and countries"
            value={num(Object.keys(facets.country).length)}
            hint="Distinct registries represented"
          />
        </Grid>
      )}

      <Panel>
        <Toolbar
          right={
            <>
              <Select
                value={`${sort}:${direction}`}
                onChange={(e) => {
                  const [key, dir] = e.target.value.split(':');
                  setSort(key);
                  setDirection(dir);
                  setPage(1);
                }}
                className="h-8 w-48 text-xs"
                aria-label="Sort order"
              >
                {SORTS.map(([key, label]) => (
                  <optgroup key={key} label={label}>
                    <option value={`${key}:asc`}>{label}, ascending</option>
                    <option value={`${key}:desc`}>{label}, descending</option>
                  </optgroup>
                ))}
              </Select>
              {(activeFilters > 0 || query) && (
                <Button size="sm" variant="ghost" icon={RotateCcw} onClick={reset}>
                  Clear
                </Button>
              )}
            </>
          }
        >
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Search name, catalogue number, operator or designator"
            className="w-full max-w-sm"
          />
          <span className="inline-flex items-center gap-1.5 text-2xs text-ink-faint">
            <Filter size={11} aria-hidden />
            {activeFilters > 0 ? `${activeFilters} filters` : 'No filters'}
          </span>
        </Toolbar>

        {facets && (
          <div className="space-y-2.5 border-b border-line px-4 py-3">
            <FilterChips
              label="Category"
              options={Object.entries(facets.category).map(([value, count]) => ({
                value,
                label: CATEGORY_LABELS[value] ?? titleCase(value),
                count,
              }))}
              selected={category}
              onToggle={toggle(setCategory)}
            />
            <div className="flex flex-wrap gap-x-6 gap-y-2.5">
              <FilterChips
                label="Orbit"
                options={Object.entries(facets.orbitClass).map(([value, count]) => ({
                  value,
                  label: value,
                  count,
                }))}
                selected={orbitClass}
                onToggle={toggle(setOrbitClass)}
              />
              <FilterChips
                label="Type"
                options={Object.entries(facets.type).map(([value, count]) => ({
                  value,
                  label: titleCase(value),
                  count,
                }))}
                selected={type}
                onToggle={toggle(setType)}
              />
            </div>
          </div>
        )}

        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data?.rows ?? []}
              loading={loading}
              sort={sort}
              direction={direction}
              onSort={onSort}
              onRowClick={(row) => navigate(`/catalog/${row.id}`)}
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
          </>
        )}
      </Panel>
    </div>
  );
}

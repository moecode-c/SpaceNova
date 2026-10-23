import { useMemo, useState } from 'react';
import { ClipboardList, Download, Plus, Target, Timer, TrendingUp } from 'lucide-react';
import { Grid, PageHeader, Panel, PanelBody, PanelFooter, StatTile } from '../../components/ui/panel.jsx';
import { DataTable, FilterChips, Pagination, Toolbar } from '../../components/ui/table.jsx';
import { Field, FormError, Input, SearchInput, Select, Textarea } from '../../components/ui/form.jsx';
import { Badge, Button, Tag } from '../../components/ui/primitives.jsx';
import { Modal } from '../../components/ui/overlay.jsx';
import { EmptyState, InlineNote, useToast } from '../../components/ui/feedback.jsx';
import { ChartCard, SERIES, TimeSeries } from '../../components/data/charts.jsx';
import { SourceTag } from '../../components/data/source.jsx';
import { useApi, useAction, useDebounced } from '../../hooks/useApi.js';
import { catalog, observations as observationsApi } from '../../api/index.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { dateShort, dateTime, deg, mag, num, percent, timeShort } from '../../lib/format.js';
import { downloadCsv } from '../../lib/download.js';

const OUTCOMES = [
  { value: 'observed', label: 'Observed' },
  { value: 'partial', label: 'Partially observed' },
  { value: 'clouded-out', label: 'Clouded out' },
  { value: 'missed', label: 'Missed' },
];

const SEEING = ['excellent', 'good', 'fair', 'poor'];

const EQUIPMENT = [
  'Naked eye',
  '10x50 binoculars',
  '8-inch Dobsonian',
  'UHF Yagi and SDR receiver',
  '80 mm refractor',
  'DSLR on a tripod',
];

export default function ObservationLog() {
  const toast = useToast();
  const { locations, activeLocation } = useSettings();

  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const [outcome, setOutcome] = useState([]);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [objectQuery, setObjectQuery] = useState('');
  const objectSearch = useDebounced(objectQuery, 250);

  const [form, setForm] = useState({
    objectId: '',
    locationId: activeLocation?.id ?? '',
    observedAt: new Date().toISOString().slice(0, 16),
    outcome: 'observed',
    predictedMaxElevation: '',
    observedMaxElevation: '',
    acquisitionErrorSeconds: '',
    reportedMagnitude: '',
    cloudCover: '0.2',
    seeing: 'good',
    equipment: 'Naked eye',
    notes: '',
  });

  const request = useMemo(
    () => ({ q: debounced, outcome, page, pageSize: 15 }),
    [debounced, outcome, page],
  );
  const log = useApi(() => observationsApi.list(request), [request]);
  const suggestions = useApi(() => catalog.suggest(objectSearch, 10), [objectSearch], {
    enabled: addOpen,
  });

  const create = useAction(() => observationsApi.create(form), {
    onSuccess: () => {
      setAddOpen(false);
      toast.success('Observation recorded');
      log.refetch();
    },
  });

  /*
   * The rows are already here, so the CSV is built in the browser and handed
   * straight to the user rather than queued as a job to collect later.
   */
  const exportLog = () => {
    const rows = log.data?.rows ?? [];
    if (rows.length === 0) {
      toast.error('Nothing to export', 'The log is empty under the current filters.');
      return;
    }
    const count = downloadCsv(
      `spacenova-observation-log-${new Date().toISOString().slice(0, 10)}.csv`,
      rows,
      [
        { key: 'observedAt', header: 'observed_at_utc' },
        { key: 'objectName', header: 'object' },
        { key: 'noradId', header: 'norad_id' },
        { key: 'locationName', header: 'location' },
        { key: 'outcome', header: 'outcome' },
        { key: 'predictedMaxElevation', header: 'predicted_max_elevation_deg' },
        { key: 'observedMaxElevation', header: 'observed_max_elevation_deg' },
        { key: 'acquisitionErrorSeconds', header: 'acquisition_error_s' },
        { key: 'estimatedMagnitude', header: 'estimated_magnitude' },
        { key: 'reportedMagnitude', header: 'reported_magnitude' },
        { key: 'cloudCover', header: 'cloud_cover' },
        { key: 'seeing', header: 'seeing' },
        { key: 'equipment', header: 'equipment' },
        { key: 'notes', header: 'notes' },
      ],
    );
    toast.success('Log exported', `${count} entries written to a CSV file.`);
  };

  const stats = log.data?.stats;

  // The acquisition error over time is the quantity the accuracy study cares
  // about, so it gets a chart rather than being buried in a column.
  const errorSeries = useMemo(
    () =>
      (log.data?.rows ?? [])
        .filter((r) => r.acquisitionErrorSeconds !== null)
        .map((r) => ({ t: r.observedAt, error: r.acquisitionErrorSeconds, age: r.elementSetAgeHours }))
        .sort((a, b) => new Date(a.t) - new Date(b.t)),
    [log.data],
  );

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ClipboardList}
        title="Observation log"
        description="What you actually saw, against what was predicted. The acquisition error column is the measurement that calibrates the staleness penalty."
        meta={log.meta ? <SourceTag meta={log.meta} /> : null}
        actions={
          <>
            <Button size="sm" variant="secondary" icon={Download} onClick={exportLog}>
              Export CSV
            </Button>
            <Button size="sm" variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>
              Record an observation
            </Button>
          </>
        }
      />

      <Grid cols={4}>
        <StatTile label="Entries" value={num(stats?.total ?? 0)} icon={ClipboardList} />
        <StatTile
          label="Observed"
          value={num(stats?.observed ?? 0)}
          tone="good"
          hint={stats ? `${percent(stats.successRate)} of attempts` : undefined}
          icon={Target}
        />
        <StatTile
          label="Mean acquisition error"
          value={
            stats?.meanAbsoluteAcquisitionErrorSeconds === null || stats === undefined
              ? '--'
              : num(stats.meanAbsoluteAcquisitionErrorSeconds, 1)
          }
          unit="s"
          hint="Absolute difference between predicted and observed AOS"
          icon={Timer}
        />
        <StatTile
          label="Sites used"
          value={num(new Set((log.data?.rows ?? []).map((r) => r.locationId)).size)}
          hint="Distinct observer locations in this view"
        />
      </Grid>

      {errorSeries.length > 2 && (
        <ChartCard
          title="Acquisition error over time"
          subtitle="Positive means the object appeared later than predicted. The band is the plus or minus five second range."
          meta={log.meta}
          height={190}
          footer={
            <InlineNote icon={TrendingUp}>
              A drift away from zero as the element-set age grows is exactly what the freshness
              penalty is meant to capture. A constant offset usually means a clock problem at the
              station rather than an orbit problem.
            </InlineNote>
          }
        >
          <TimeSeries
            height={190}
            tickFormat="day"
            data={errorSeries}
            series={[{ key: 'error', name: 'Acquisition error (s)', colour: SERIES.primary }]}
            formatValue={(v) => `${v > 0 ? '+' : ''}${num(v, 1)} s`}
            referenceAreas={[{ y1: -5, y2: 5, colour: SERIES.good, opacity: 0.06 }]}
            referenceLines={[{ y: 0, label: 'on time', colour: SERIES.muted }]}
          />
        </ChartCard>
      )}

      <Panel>
        <Toolbar>
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Search object, site, equipment or notes"
            className="w-full max-w-sm"
          />
          <FilterChips
            label="Outcome"
            options={OUTCOMES}
            selected={outcome}
            onToggle={(value) => {
              setPage(1);
              setOutcome((list) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]));
            }}
          />
        </Toolbar>

        <DataTable
          loading={log.loading}
          columns={[
            {
              key: 'observedAt',
              header: 'When (UTC)',
              render: (r) => (
                <div>
                  <p className="tnum font-mono text-ink">{dateShort(r.observedAt)}</p>
                  <p className="tnum font-mono text-2xs text-ink-faint">{timeShort(r.observedAt, true)}</p>
                </div>
              ),
            },
            {
              key: 'objectName',
              header: 'Object',
              nowrap: false,
              render: (r) => (
                <div className="min-w-0">
                  <p className="truncate text-ink">{r.objectName}</p>
                  <p className="tnum truncate font-mono text-2xs text-ink-faint">{r.noradId}</p>
                </div>
              ),
            },
            { key: 'locationName', header: 'Site', hideBelow: 'md' },
            {
              key: 'outcome',
              header: 'Outcome',
              render: (r) => (
                <Badge tone={r.outcomeTone} size="sm">
                  {r.outcomeLabel}
                </Badge>
              ),
            },
            {
              key: 'predictedMaxElevation',
              header: 'Predicted / observed',
              align: 'right',
              mono: true,
              hideBelow: 'lg',
              render: (r) => (
                <span>
                  {deg(r.predictedMaxElevation, 1)}
                  <span className="text-ink-faint"> / </span>
                  {r.observedMaxElevation === null ? '--' : deg(r.observedMaxElevation, 1)}
                </span>
              ),
            },
            {
              key: 'acquisitionErrorSeconds',
              header: 'AOS error',
              align: 'right',
              mono: true,
              render: (r) =>
                r.acquisitionErrorSeconds === null ? (
                  <span className="text-ink-faint">--</span>
                ) : (
                  <span className={Math.abs(r.acquisitionErrorSeconds) > 5 ? 'text-warn' : 'text-good'}>
                    {r.acquisitionErrorSeconds > 0 ? '+' : ''}
                    {num(r.acquisitionErrorSeconds, 1)} s
                  </span>
                ),
            },
            {
              key: 'reportedMagnitude',
              header: 'Magnitude',
              align: 'right',
              mono: true,
              hideBelow: 'xl',
              render: (r) => (
                <span>
                  {mag(r.estimatedMagnitude)}
                  <span className="text-ink-faint"> est / </span>
                  {r.reportedMagnitude === null ? '--' : mag(r.reportedMagnitude)}
                </span>
              ),
            },
            {
              key: 'equipment',
              header: 'Equipment',
              hideBelow: 'xl',
              render: (r) => <Tag mono={false}>{r.equipment}</Tag>,
            },
            {
              key: 'notes',
              header: 'Note',
              nowrap: false,
              hideBelow: 'xl',
              render: (r) => <span className="line-clamp-1 text-ink-faint">{r.notes}</span>,
            },
          ]}
          rows={log.data?.rows ?? []}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="Nothing logged yet"
              description="Record what you saw after a session. Over time the log is what tells you how well the predictions actually perform."
              action={
                <Button size="sm" variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>
                  Record an observation
                </Button>
              }
            />
          }
        />
        <Pagination
          page={log.data?.page ?? 1}
          pages={log.data?.pages ?? 1}
          total={log.data?.total ?? 0}
          from={log.data?.from ?? 0}
          to={log.data?.to ?? 0}
          onPage={setPage}
          unit="entries"
        />
      </Panel>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Record an observation"
        description="Only the object, site and outcome are required. The rest sharpens the accuracy study."
        size="lg"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" loading={create.pending} onClick={() => create.run()}>
              Save entry
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {create.error && create.error.code !== 'validation' && <FormError error={create.error} />}

          <Field label="Object" error={create.fieldErrors?.objectId} required hint="Search the catalogue.">
            <SearchInput value={objectQuery} onChange={setObjectQuery} placeholder="Name or catalogue number" />
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {(suggestions.data ?? []).map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => set('objectId')(row.id)}
                  className={
                    form.objectId === row.id
                      ? 'flex w-full items-center justify-between gap-3 rounded-md border border-primary-dim bg-primary-soft/40 px-3 py-1.5 text-left'
                      : 'flex w-full items-center justify-between gap-3 rounded-md border border-line bg-base/40 px-3 py-1.5 text-left transition-colors hover:border-line-strong'
                  }
                >
                  <span className="truncate text-xs text-ink">{row.name}</span>
                  <span className="tnum shrink-0 font-mono text-2xs text-ink-faint">{row.noradId}</span>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Observer location" htmlFor="obsLoc">
              <Select id="obsLoc" value={form.locationId} onChange={(e) => set('locationId')(e.target.value)}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="When (UTC)" htmlFor="obsAt">
              <Input
                id="obsAt"
                type="datetime-local"
                value={form.observedAt}
                onChange={(e) => set('observedAt')(e.target.value)}
              />
            </Field>
            <Field label="Outcome" htmlFor="obsOutcome">
              <Select id="obsOutcome" value={form.outcome} onChange={(e) => set('outcome')(e.target.value)}>
                {OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Equipment" htmlFor="obsEquip">
              <Select id="obsEquip" value={form.equipment} onChange={(e) => set('equipment')(e.target.value)}>
                {EQUIPMENT.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Predicted maximum elevation" htmlFor="obsPred" hint="Degrees, from the plan.">
              <Input
                id="obsPred"
                type="number"
                step="0.1"
                value={form.predictedMaxElevation}
                onChange={(e) => set('predictedMaxElevation')(e.target.value)}
                suffix="deg"
              />
            </Field>
            <Field label="Observed maximum elevation" htmlFor="obsSeen" hint="Degrees, if you measured it.">
              <Input
                id="obsSeen"
                type="number"
                step="0.1"
                value={form.observedMaxElevation}
                onChange={(e) => set('observedMaxElevation')(e.target.value)}
                suffix="deg"
              />
            </Field>
            <Field
              label="Acquisition error"
              htmlFor="obsErr"
              hint="Seconds. Positive means it appeared later than predicted."
            >
              <Input
                id="obsErr"
                type="number"
                step="0.1"
                value={form.acquisitionErrorSeconds}
                onChange={(e) => set('acquisitionErrorSeconds')(e.target.value)}
                suffix="s"
              />
            </Field>
            <Field label="Reported magnitude" htmlFor="obsMag" hint="Your own estimate at closest approach.">
              <Input
                id="obsMag"
                type="number"
                step="0.1"
                value={form.reportedMagnitude}
                onChange={(e) => set('reportedMagnitude')(e.target.value)}
              />
            </Field>
            <Field label="Cloud cover" htmlFor="obsCloud" hint="Fraction between 0 and 1.">
              <Input
                id="obsCloud"
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={form.cloudCover}
                onChange={(e) => set('cloudCover')(e.target.value)}
              />
            </Field>
            <Field label="Seeing" htmlFor="obsSeeing">
              <Select id="obsSeeing" value={form.seeing} onChange={(e) => set('seeing')(e.target.value)}>
                {SEEING.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Notes" htmlFor="obsNotes" hint="What happened, and anything that would change how you read the numbers later.">
            <Textarea id="obsNotes" rows={3} value={form.notes} onChange={(e) => set('notes')(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Panel>
        <PanelBody>
          <InlineNote>
            Entries are yours alone. They are included in your exports and deleted with your
            account, and they are never attached to a shared workspace link unless you freeze them
            into a dataset snapshot yourself.
          </InlineNote>
        </PanelBody>
        <PanelFooter>
          <span className="text-2xs text-ink-faint">
            Last entry {log.data?.rows?.[0] ? dateTime(log.data.rows[0].observedAt) : 'none'}.
          </span>
        </PanelFooter>
      </Panel>
    </div>
  );
}

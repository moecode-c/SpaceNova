import { useState } from 'react';
import { CloudOff, Database, Play, RefreshCw, Trash2, Wifi } from 'lucide-react';
import { Grid, KeyValue, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, Section, StatTile } from '../../components/ui/panel.jsx';
import { DataTable } from '../../components/ui/table.jsx';
import { Switch } from '../../components/ui/form.jsx';
import { Badge, Button, Tag } from '../../components/ui/primitives.jsx';
import { Banner, InlineNote, LoadingState, useToast } from '../../components/ui/feedback.jsx';
import { SourceTag } from '../../components/data/source.jsx';
import { useApi, useAction } from '../../hooks/useApi.js';
import { admin } from '../../api/index.js';
import { age, dateTime, num } from '../../lib/format.js';

export default function Sources() {
  const toast = useToast();
  const { data, meta, loading, refetch } = useApi(() => admin.dataSources(), []);
  const [busy, setBusy] = useState(null);

  const toggle = useAction((id, enabled) => admin.toggleSource(id, enabled), {
    onSuccess: () => refetch(),
  });

  const run = useAction((id) => admin.runIngest(id), {
    onSuccess: (source) => {
      setBusy(null);
      toast.success('Fetch complete', `${source.name} validated and stored.`);
      refetch();
    },
    onError: (error) => {
      setBusy(null);
      toast.error('Fetch failed', error.message);
      refetch();
    },
  });

  const purge = useAction((id) => admin.purgeCache(id), {
    onSuccess: () => {
      toast.warn('Cache purged', 'The next scheduled run repopulates it.');
      refetch();
    },
  });

  if (loading && !data) return <LoadingState label="Loading ingestion health" />;
  if (!data) return null;

  const { sources, summary, degradedModeRules, degradedModeLimitHours } = data;
  const offline = sources.filter((s) => s.health === 'offline');

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Database}
        title="Data sources"
        description="Every external provider, its licence, its refresh interval and its current health. When a provider is unreachable the platform serves cache with a visible banner rather than failing silently."
        meta={meta ? <SourceTag meta={meta} /> : null}
      />

      {offline.length > 0 && (
        <Banner tone="bad" title={`${offline.length} provider unreachable`} icon={CloudOff}>
          {offline.map((s) => s.name).join(', ')} cannot be reached. Cached data is being served
          within the {degradedModeLimitHours} hour degraded-mode limit, and every affected panel
          carries a staleness banner naming the source and the age.
        </Banner>
      )}

      <Grid cols={4}>
        <StatTile label="Providers" value={num(sources.length)} icon={Database} />
        <StatTile label="Nominal" value={num(summary.nominal)} tone="good" icon={Wifi} />
        <StatTile
          label="Degraded or limited"
          value={num(summary.degraded)}
          tone={summary.degraded ? 'warn' : 'default'}
        />
        <StatTile
          label="Serving from cache"
          value={num(summary.servingFromCache)}
          tone={summary.servingFromCache ? 'warn' : 'default'}
          icon={CloudOff}
        />
      </Grid>

      <div className="space-y-3">
        {sources.map((source) => (
          <Panel key={source.id}>
            <PanelHeader
              title={source.name}
              subtitle={source.endpoint}
              actions={
                <div className="flex items-center gap-2">
                  <Badge tone={source.healthTone} dot>
                    {source.healthLabel}
                  </Badge>
                  <Tag>{source.kind}</Tag>
                </div>
              }
            />
            <PanelBody className="space-y-3">
              <KeyValue
                dense
                columns={3}
                rows={[
                  { label: 'Last success', value: `${age(source.lastSuccessAt)} (${dateTime(source.lastSuccessAt)})`, mono: false },
                  { label: 'Last attempt', value: age(source.lastAttemptAt) },
                  { label: 'Next refresh', value: age(source.nextRefreshAt) },
                  { label: 'Time to live', value: `${source.ttlMinutes} min` },
                  { label: 'Cache age', value: `${num(source.cacheAgeMinutes)} min` },
                  { label: 'Records stored', value: num(source.recordsStored) },
                  {
                    label: 'Rate limit',
                    value: source.rateLimitPerHour ? `${num(source.rateLimitPerHour)}/h` : 'none published',
                    mono: !!source.rateLimitPerHour,
                  },
                  { label: 'Requests last hour', value: num(source.requestsLastHour) },
                  { label: 'Mean latency', value: `${num(source.meanLatencyMs)} ms` },
                  { label: 'Failures, 24 h', value: num(source.failuresLastDay) },
                  { label: 'Validation failures, 24 h', value: num(source.validationFailuresLastDay) },
                  { label: 'Licence', value: source.licence, mono: false, wide: true },
                ]}
              />

              {source.notes && (
                <div className="panel-inset flex items-start gap-2.5 p-2.5">
                  <CloudOff size={13} className="mt-0.5 shrink-0 text-warn" aria-hidden />
                  <p className="text-2xs leading-relaxed text-ink-faint">{source.notes}</p>
                </div>
              )}

              <Switch
                checked={source.enabled}
                onChange={(value) => toggle.run(source.id, value)}
                label={source.enabled ? 'Enabled' : 'Disabled'}
                description={
                  source.enabled
                    ? 'Scheduled refreshes run and the cache is kept current.'
                    : 'No requests are made. Consumers fall back to cache, then to nothing.'
                }
              />
            </PanelBody>
            <PanelFooter>
              <Button
                size="xs"
                variant="outline"
                icon={Play}
                loading={busy === source.id && run.pending}
                onClick={() => {
                  setBusy(source.id);
                  run.run(source.id);
                }}
              >
                Run now
              </Button>
              <Button size="xs" variant="ghost" icon={Trash2} onClick={() => purge.run(source.id)}>
                Purge cache
              </Button>
              <span className="ml-auto text-2xs text-ink-faint">
                {source.servingFromCache ? 'Currently serving from cache' : 'Serving live data'}
              </span>
            </PanelFooter>
          </Panel>
        ))}
      </div>

      <Section
        title="Degraded mode rules"
        description="What the platform does in each failure case. These are rules, not guidance: the ingestion service implements them directly."
      >
        <Panel>
          <DataTable
            rowKey={(r) => r[0]}
            columns={[
              { key: '0', header: 'Condition', nowrap: false, width: '38%', render: (r) => <span className="text-ink">{r[0]}</span> },
              { key: '1', header: 'Action', nowrap: false, render: (r) => <span className="text-ink-faint">{r[1]}</span> },
            ]}
            rows={degradedModeRules}
          />
          <PanelFooter>
            <InlineNote icon={RefreshCw}>
              Cache is served without comment while it is inside its time to live. Past that, and
              within the {degradedModeLimitHours} hour limit, it is served with a visible banner.
              Beyond the limit the value is reported as unavailable rather than shown stale.
            </InlineNote>
          </PanelFooter>
        </Panel>
      </Section>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Lock, ScrollText, ShieldAlert } from 'lucide-react';
import { Grid, PageHeader, Panel, PanelBody, PanelFooter, StatTile } from '../../components/ui/panel.jsx';
import { DataTable, FilterChips, Pagination, Toolbar } from '../../components/ui/table.jsx';
import { SearchInput } from '../../components/ui/form.jsx';
import { Avatar, Badge, Tag } from '../../components/ui/primitives.jsx';
import { EmptyState, InlineNote } from '../../components/ui/feedback.jsx';
import { SourceTag } from '../../components/data/source.jsx';
import { useApi, useDebounced } from '../../hooks/useApi.js';
import { admin } from '../../api/index.js';
import { age, dateTime, num } from '../../lib/format.js';

export default function Audit() {
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const [action, setAction] = useState([]);
  const [page, setPage] = useState(1);

  const request = useMemo(
    () => ({ q: debounced, action, page, pageSize: 20 }),
    [debounced, action, page],
  );
  const log = useApi(() => admin.auditLog(request), [request]);

  const rows = log.data?.rows ?? [];
  const actions = log.meta?.actions ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ScrollText}
        title="Audit log"
        description="Every administrative action, with who did it, what they touched and why. The log is append only: entries are never edited or removed."
        meta={
          <>
            <Badge tone="info" size="sm" icon={Lock}>
              Append only
            </Badge>
            {log.meta && <SourceTag meta={log.meta} />}
          </>
        }
      />

      <Grid cols={4}>
        <StatTile label="Entries" value={num(log.data?.total ?? 0)} icon={ScrollText} />
        <StatTile
          label="Distinct actions"
          value={num(actions.length)}
          hint="Kinds of administrative change recorded"
        />
        <StatTile
          label="Actors"
          value={num(new Set(rows.map((r) => r.actorId)).size)}
          hint="Administrators in the current view"
        />
        <StatTile
          label="Most recent"
          value={rows[0] ? age(rows[0].at) : '--'}
          hint={rows[0] ? rows[0].label : ''}
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
            placeholder="Search action, actor, target or detail"
            className="w-full max-w-sm"
          />
          <FilterChips
            label="Action"
            options={actions.slice(0, 8).map((a) => ({ value: a, label: a }))}
            selected={action}
            onToggle={(value) => {
              setPage(1);
              setAction((list) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]));
            }}
          />
        </Toolbar>

        <DataTable
          loading={log.loading}
          columns={[
            {
              key: 'at',
              header: 'When (UTC)',
              render: (r) => (
                <div>
                  <p className="tnum font-mono text-ink">{dateTime(r.at, true)}</p>
                  <p className="text-2xs text-ink-faint">{age(r.at)}</p>
                </div>
              ),
            },
            {
              key: 'label',
              header: 'Action',
              nowrap: false,
              render: (r) => (
                <div className="min-w-0">
                  <p className="truncate text-ink">{r.label}</p>
                  <p className="truncate font-mono text-2xs text-ink-faint">{r.action}</p>
                </div>
              ),
            },
            {
              key: 'actorName',
              header: 'Actor',
              render: (r) => (
                <div className="flex items-center gap-2">
                  <Avatar name={r.actorName} size="sm" />
                  <span className="truncate">{r.actorName}</span>
                </div>
              ),
            },
            {
              key: 'target',
              header: 'Target',
              nowrap: false,
              hideBelow: 'md',
              render: (r) => <code className="font-code text-2xs text-ink-dim">{r.target}</code>,
            },
            {
              key: 'detail',
              header: 'Detail',
              nowrap: false,
              hideBelow: 'lg',
              render: (r) => <span className="text-ink-faint">{r.detail}</span>,
            },
            {
              key: 'tone',
              header: 'Severity',
              render: (r) => (
                <Badge tone={r.tone} size="sm">
                  {r.tone === 'bad' ? 'High' : r.tone === 'warn' ? 'Notable' : 'Routine'}
                </Badge>
              ),
            },
            {
              key: 'ip',
              header: 'Source',
              mono: true,
              hideBelow: 'xl',
              render: (r) => <span className="text-ink-faint">{r.ip}</span>,
            },
          ]}
          rows={rows}
          empty={
            <EmptyState
              icon={ScrollText}
              title="No entries match"
              description="Clear the filters or widen the search."
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

      <Panel>
        <PanelBody className="space-y-2.5">
          <InlineNote icon={ShieldAlert}>
            What is recorded: role changes and approvals, account suspensions and reinstatements,
            data source enable and disable, manual ingestion runs and cache purges, threshold
            changes, catalogue corrections, content publication and share-link revocations.
          </InlineNote>
          <InlineNote>
            What is not recorded here: ordinary use. Running a prediction, opening a workspace or
            logging an observation is not an administrative action and does not appear in this log.
          </InlineNote>
        </PanelBody>
        <PanelFooter>
          <Tag mono={false}>Append only, never edited, never deleted</Tag>
        </PanelFooter>
      </Panel>
    </div>
  );
}

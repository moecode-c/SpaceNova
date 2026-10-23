import { useMemo, useState } from 'react';
import { Ban, CheckCircle2, Mail, ShieldCheck, Users as UsersIcon } from 'lucide-react';
import { Grid, PageHeader, Panel, PanelBody, PanelFooter, StatTile } from '../../components/ui/panel.jsx';
import { DataTable, FilterChips, Pagination, Toolbar } from '../../components/ui/table.jsx';
import { SearchInput, Select } from '../../components/ui/form.jsx';
import { Avatar, Badge, Button, Tag } from '../../components/ui/primitives.jsx';
import { ConfirmDialog } from '../../components/ui/overlay.jsx';
import { EmptyState, InlineNote, useToast } from '../../components/ui/feedback.jsx';
import { SourceTag } from '../../components/data/source.jsx';
import { StatusBadge } from '../../components/data/badges.jsx';
import { useApi, useAction, useDebounced } from '../../hooks/useApi.js';
import { admin } from '../../api/index.js';
import { ROLES } from '../../mock/people.js';
import { age, dateShort, num } from '../../lib/format.js';

const ROLE_OPTIONS = ['user', 'researcher', 'engineer', 'admin'];

export default function AdminUsers() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const [role, setRole] = useState([]);
  const [status, setStatus] = useState([]);
  const [page, setPage] = useState(1);
  const [suspending, setSuspending] = useState(null);

  const request = useMemo(
    () => ({ q: debounced, role, status, page, pageSize: 15, sort: 'name', direction: 'asc' }),
    [debounced, role, status, page],
  );
  const users = useApi(() => admin.users(request), [request]);

  const update = useAction((id, patch) => admin.updateUser(id, patch), {
    onSuccess: () => {
      users.refetch();
      setSuspending(null);
    },
  });

  const rows = users.data?.rows ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={UsersIcon}
        title="Accounts"
        description="Every account on the platform, its role and its state. Role changes and suspensions are written to the audit log."
        meta={users.meta ? <SourceTag meta={users.meta} /> : null}
      />

      <Grid cols={4}>
        <StatTile label="Accounts" value={num(users.data?.total ?? 0)} icon={UsersIcon} />
        <StatTile
          label="Administrators"
          value={num(rows.filter((u) => u.role === 'admin').length)}
          tone="warn"
          icon={ShieldCheck}
          hint="In the current view"
        />
        <StatTile
          label="Unverified"
          value={num(rows.filter((u) => !u.emailVerified).length)}
          icon={Mail}
          hint="Cannot sign in until confirmed"
        />
        <StatTile
          label="Suspended"
          value={num(rows.filter((u) => u.status === 'suspended').length)}
          tone={rows.some((u) => u.status === 'suspended') ? 'bad' : 'default'}
          icon={Ban}
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
            placeholder="Search name, email or institution"
            className="w-full max-w-sm"
          />
          <FilterChips
            label="Role"
            options={ROLE_OPTIONS.map((r) => ({ value: r, label: ROLES[r].label }))}
            selected={role}
            onToggle={(value) => {
              setPage(1);
              setRole((list) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]));
            }}
          />
          <FilterChips
            label="State"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'unverified', label: 'Unverified' },
              { value: 'suspended', label: 'Suspended' },
            ]}
            selected={status}
            onToggle={(value) => {
              setPage(1);
              setStatus((list) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]));
            }}
          />
        </Toolbar>

        <DataTable
          loading={users.loading}
          columns={[
            {
              key: 'name',
              header: 'Account',
              nowrap: false,
              render: (u) => (
                <div className="flex items-center gap-2.5">
                  <Avatar name={u.name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{u.name}</p>
                    <p className="truncate text-2xs text-ink-faint">{u.email}</p>
                  </div>
                </div>
              ),
            },
            { key: 'institution', header: 'Institution', hideBelow: 'lg' },
            {
              key: 'role',
              header: 'Role',
              render: (u) => (
                <Select
                  className="h-7 w-32 text-2xs"
                  value={u.role}
                  onChange={(e) => {
                    update.run(u.id, { role: e.target.value });
                    toast.success('Role changed', `${u.name} is now a ${ROLES[e.target.value].label}.`);
                  }}
                  aria-label={`Role for ${u.name}`}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLES[r].label}
                    </option>
                  ))}
                </Select>
              ),
            },
            { key: 'status', header: 'State', render: (u) => <StatusBadge status={u.status} /> },
            {
              key: 'emailVerified',
              header: 'Email',
              hideBelow: 'md',
              render: (u) =>
                u.emailVerified ? (
                  <Badge tone="good" size="sm" icon={CheckCircle2}>
                    Confirmed
                  </Badge>
                ) : (
                  <Badge tone="warn" size="sm">
                    Pending
                  </Badge>
                ),
            },
            { key: 'lastSeenAt', header: 'Last seen', mono: true, hideBelow: 'lg', render: (u) => age(u.lastSeenAt) },
            { key: 'createdAt', header: 'Joined', mono: true, hideBelow: 'xl', render: (u) => dateShort(u.createdAt) },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (u) =>
                u.status === 'suspended' ? (
                  <Button size="xs" variant="ghost" onClick={() => update.run(u.id, { status: 'active' })}>
                    Reinstate
                  </Button>
                ) : (
                  <Button size="xs" variant="ghost" onClick={() => setSuspending(u)}>
                    Suspend
                  </Button>
                ),
            },
          ]}
          rows={rows}
          empty={
            <EmptyState
              icon={UsersIcon}
              title="No accounts match"
              description="Clear the filters or widen the search."
            />
          }
        />
        <Pagination
          page={users.data?.page ?? 1}
          pages={users.data?.pages ?? 1}
          total={users.data?.total ?? 0}
          from={users.data?.from ?? 0}
          to={users.data?.to ?? 0}
          onPage={setPage}
          unit="accounts"
        />
      </Panel>

      <Panel>
        <PanelBody className="space-y-2.5">
          <InlineNote>
            A role change takes effect immediately. The account keeps everything it created: an
            account demoted from Researcher keeps its workspaces but can no longer open them until
            the role is restored.
          </InlineNote>
          <InlineNote>
            Suspension blocks sign-in without deleting anything. Share links the account created
            keep working until they are revoked from the moderation screen.
          </InlineNote>
        </PanelBody>
        <PanelFooter>
          <Tag mono={false}>Every change here is written to the audit log</Tag>
        </PanelFooter>
      </Panel>

      <ConfirmDialog
        open={!!suspending}
        onClose={() => setSuspending(null)}
        onConfirm={() => update.run(suspending.id, { status: 'suspended' })}
        loading={update.pending}
        title={`Suspend ${suspending?.name}?`}
        body="They will not be able to sign in. Nothing they created is deleted, and the action is recorded in the audit log with your name against it."
        confirmLabel="Suspend account"
      />
    </div>
  );
}

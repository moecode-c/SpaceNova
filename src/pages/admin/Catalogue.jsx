import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Database, Pencil, Satellite } from 'lucide-react';
import { Grid, PageHeader, Panel, PanelBody, PanelFooter, StatTile } from '../../components/ui/panel.jsx';
import { DataTable, Pagination, Toolbar } from '../../components/ui/table.jsx';
import { Field, FormError, Input, SearchInput, Select } from '../../components/ui/form.jsx';
import { Button, IconButton, Tag } from '../../components/ui/primitives.jsx';
import { Modal } from '../../components/ui/overlay.jsx';
import { EmptyState, InlineNote, useToast } from '../../components/ui/feedback.jsx';
import { FixtureNotice, SourceTag } from '../../components/data/source.jsx';
import { FreshnessBadge, OrbitBadge, StatusBadge } from '../../components/data/badges.jsx';
import { useApi, useAction, useDebounced } from '../../hooks/useApi.js';
import { admin } from '../../api/index.js';
import { freshnessOf } from '../../engine/freshness.js';
import { km, mag, num } from '../../lib/format.js';

export default function Catalogue() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);

  const request = useMemo(
    () => ({ q: debounced, page, pageSize: 15, sort: 'name', direction: 'asc' }),
    [debounced, page],
  );
  const catalogue = useApi(() => admin.catalogue(request), [request]);

  const save = useAction(
    () =>
      admin.updateObject(editing.id, {
        name: editing.name,
        operator: editing.operator,
        country: editing.country,
        status: editing.status,
        standardMagnitude: Number(editing.standardMagnitude),
      }),
    {
      onSuccess: () => {
        setEditing(null);
        toast.success('Record updated', 'The change is written to the audit log.');
        catalogue.refetch();
      },
    },
  );

  const rows = catalogue.data?.rows ?? [];
  const now = new Date();

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Database}
        title="Catalogue administration"
        description="Correct metadata on a catalogue record. Orbital elements are never edited by hand: they come from the providers and are replaced wholesale."
        meta={catalogue.meta ? <SourceTag meta={catalogue.meta} /> : null}
      />

      <FixtureNotice compact />

      <Grid cols={4}>
        <StatTile label="Records" value={num(catalogue.data?.total ?? 0)} icon={Satellite} />
        <StatTile
          label="Active"
          value={num(rows.filter((o) => o.status === 'active').length)}
          tone="good"
          hint="In the current view"
        />
        <StatTile
          label="Low Earth orbit"
          value={num(rows.filter((o) => o.orbitClass === 'LEO').length)}
          hint="In the current view"
        />
        <StatTile
          label="Stale element sets"
          value={num(
            rows.filter((o) => {
              const f = freshnessOf(o.elementSet.epoch, now);
              return f.key === 'stale' || f.key === 'expired';
            }).length,
          )}
          tone="warn"
          hint="Seven days or older"
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
            placeholder="Search name, designator, operator or catalogue number"
            className="w-full max-w-md"
          />
        </Toolbar>

        <DataTable
          loading={catalogue.loading}
          columns={[
            {
              key: 'name',
              header: 'Object',
              nowrap: false,
              render: (o) => (
                <div className="min-w-0">
                  <Link to={`/catalog/${o.id}`} className="truncate font-medium text-ink hover:text-primary-bright">
                    {o.name}
                  </Link>
                  <p className="tnum truncate font-mono text-2xs text-ink-faint">
                    {o.noradId} &middot; {o.intlDes}
                  </p>
                </div>
              ),
            },
            { key: 'operator', header: 'Operator', hideBelow: 'lg' },
            { key: 'country', header: 'Registry', hideBelow: 'xl' },
            { key: 'orbitClass', header: 'Orbit', render: (o) => <OrbitBadge orbitClass={o.orbitClass} /> },
            { key: 'perigeeKm', header: 'Perigee', align: 'right', mono: true, hideBelow: 'md', render: (o) => km(o.perigeeKm, 0) },
            {
              key: 'standardMagnitude',
              header: 'Std magnitude',
              align: 'right',
              mono: true,
              hideBelow: 'lg',
              render: (o) => mag(o.standardMagnitude),
            },
            {
              key: 'elementSet',
              header: 'Element set',
              render: (o) => <FreshnessBadge freshness={freshnessOf(o.elementSet.epoch, now)} />,
            },
            { key: 'status', header: 'State', render: (o) => <StatusBadge status={o.status} /> },
            {
              key: 'edit',
              header: '',
              align: 'right',
              render: (o) => (
                <IconButton
                  icon={Pencil}
                  label={`Edit ${o.name}`}
                  size="xs"
                  onClick={() =>
                    setEditing({
                      id: o.id,
                      name: o.name,
                      operator: o.operator,
                      country: o.country,
                      status: o.status,
                      standardMagnitude: String(o.standardMagnitude),
                    })
                  }
                />
              ),
            },
          ]}
          rows={rows}
          empty={<EmptyState icon={Database} title="No records match" description="Widen the search." />}
        />
        <Pagination
          page={catalogue.data?.page ?? 1}
          pages={catalogue.data?.pages ?? 1}
          total={catalogue.data?.total ?? 0}
          from={catalogue.data?.from ?? 0}
          to={catalogue.data?.to ?? 0}
          onPage={setPage}
          unit="records"
        />
      </Panel>

      <Panel>
        <PanelBody className="space-y-2.5">
          <InlineNote>
            Standard magnitude is the only brightness figure an administrator sets. Everything the
            platform shows about brightness is derived from it, so an error here propagates into
            every magnitude estimate for that object.
          </InlineNote>
          <InlineNote>
            Orbital elements are not editable. A wrong element set is corrected by the provider and
            arrives as a new set; the history keeps both so the correction is visible.
          </InlineNote>
        </PanelBody>
        <PanelFooter>
          <Tag mono={false}>Every edit here is written to the audit log</Tag>
        </PanelFooter>
      </Panel>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit catalogue record"
        description="Metadata only. Orbital elements come from the provider."
        size="sm"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" loading={save.pending} onClick={() => save.run()}>
              Save record
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            {save.error && <FormError error={save.error} />}
            <Field label="Name" htmlFor="objName">
              <Input id="objName" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Operator" htmlFor="objOp">
              <Input
                id="objOp"
                value={editing.operator}
                onChange={(e) => setEditing({ ...editing, operator: e.target.value })}
              />
            </Field>
            <Field label="Registry" htmlFor="objCountry">
              <Input
                id="objCountry"
                value={editing.country}
                onChange={(e) => setEditing({ ...editing, country: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="State" htmlFor="objStatus">
                <Select
                  id="objStatus"
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="decayed">Decayed</option>
                </Select>
              </Field>
              <Field
                label="Standard magnitude"
                htmlFor="objMag"
                hint="Brightness at 1 000 km, half illuminated."
              >
                <Input
                  id="objMag"
                  type="number"
                  step="0.1"
                  value={editing.standardMagnitude}
                  onChange={(e) => setEditing({ ...editing, standardMagnitude: e.target.value })}
                />
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

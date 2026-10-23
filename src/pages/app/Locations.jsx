import { useState } from 'react';
import { Check, MapPin, Mountain, Plus, Star, Trash2 } from 'lucide-react';
import { Grid, KeyValue, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, StatTile } from '../../components/ui/panel.jsx';
import { Field, FormError, Input, Select, Slider, Textarea } from '../../components/ui/form.jsx';
import { Badge, Button, IconButton, Tag } from '../../components/ui/primitives.jsx';
import { ConfirmDialog, Modal } from '../../components/ui/overlay.jsx';
import { EmptyState, InlineNote, LoadingState, useToast } from '../../components/ui/feedback.jsx';
import { WorldMap } from '../../components/map/WorldMap.jsx';
import { HorizonMaskEditor } from '../../components/map/PolarChart.jsx';
import { SourceTag } from '../../components/data/source.jsx';
import { useApi, useAction } from '../../hooks/useApi.js';
import { locations as locationsApi } from '../../api/index.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { latLon, num } from '../../lib/format.js';

const BORTLE = [
  [1, 'Excellent dark site'],
  [2, 'Typical truly dark site'],
  [3, 'Rural sky'],
  [4, 'Rural to suburban transition'],
  [5, 'Suburban sky'],
  [6, 'Bright suburban sky'],
  [7, 'Suburban to urban transition'],
  [8, 'City sky'],
  [9, 'Inner-city sky'],
];

const EMPTY = {
  name: '',
  place: '',
  latitude: '',
  longitude: '',
  altitudeM: '0',
  bortleClass: '5',
  minElevationDeg: '10',
  notes: '',
};

export default function Locations() {
  const toast = useToast();
  const { activeLocationId, setActiveLocationId, refreshLocations } = useSettings();
  const list = useApi(() => locationsApi.list(), []);

  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [maskFor, setMaskFor] = useState(null);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const save = useAction(
    () =>
      form?.id
        ? locationsApi.update(form.id, {
            name: form.name,
            place: form.place,
            latitude: Number(form.latitude),
            longitude: Number(form.longitude),
            altitudeM: Number(form.altitudeM),
            bortleClass: Number(form.bortleClass),
            minElevationDeg: Number(form.minElevationDeg),
            notes: form.notes,
          })
        : locationsApi.create(form),
    {
      onSuccess: async () => {
        toast.success(form?.id ? 'Location updated' : 'Location added');
        setForm(null);
        await refreshLocations();
        list.refetch();
      },
    },
  );

  const remove = useAction((id) => locationsApi.remove(id), {
    onSuccess: async () => {
      setDeleting(null);
      toast.success('Location removed');
      await refreshLocations();
      list.refetch();
    },
    onError: (error) => toast.error('Could not remove', error.message),
  });

  const saveMask = useAction(
    (id, mask) => locationsApi.update(id, { horizonMask: mask }),
    {
      onSuccess: async () => {
        toast.success('Horizon mask saved', 'It takes effect on the next scan.');
        setMaskFor(null);
        await refreshLocations();
        list.refetch();
      },
    },
  );

  const rows = list.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={MapPin}
        title="Observer locations"
        description="Every look angle, pass and visibility decision on this platform is relative to one of these sites. Each carries its own minimum elevation and horizon obstruction mask."
        meta={list.meta ? <SourceTag meta={list.meta} /> : null}
        actions={
          <Button size="sm" variant="primary" icon={Plus} onClick={() => setForm({ ...EMPTY })}>
            Add a location
          </Button>
        }
      />

      <Grid cols={4}>
        <StatTile label="Saved sites" value={num(rows.length)} icon={MapPin} />
        <StatTile
          label="Active site"
          value={rows.find((l) => l.id === activeLocationId)?.name ?? '--'}
          hint="Used across the whole application"
          tone="primary"
          icon={Star}
        />
        <StatTile
          label="Darkest site"
          value={rows.length ? `Bortle ${num(Math.min(...rows.map((l) => l.bortleClass)), 1)}` : '--'}
          hint={rows.length ? rows.reduce((b, l) => (l.bortleClass < b.bortleClass ? l : b), rows[0]).name : ''}
        />
        <StatTile
          label="Highest site"
          value={rows.length ? `${num(Math.max(...rows.map((l) => l.altitudeM)))} m` : '--'}
          icon={Mountain}
          hint="Altitude above sea level"
        />
      </Grid>

      {rows.length > 0 && (
        <Panel>
          <PanelHeader title="Sites" subtitle="Each marker is a saved observer location." icon={MapPin} />
          <PanelBody padded={false}>
            <WorldMap
              mode="flat"
              height={260}
              stations={rows.map((l) => ({ id: l.id, latitude: l.latitude, longitude: l.longitude }))}
              observer={
                rows.find((l) => l.id === activeLocationId)
                  ? {
                      latitude: rows.find((l) => l.id === activeLocationId).latitude,
                      longitude: rows.find((l) => l.id === activeLocationId).longitude,
                      name: rows.find((l) => l.id === activeLocationId).name,
                    }
                  : undefined
              }
              showFootprints={false}
              interactive={false}
            />
          </PanelBody>
        </Panel>
      )}

      {list.loading && rows.length === 0 ? (
        <Panel>
          <LoadingState label="Loading locations" />
        </Panel>
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon={MapPin}
            title="No observer locations"
            description="Add the place you observe from. Latitude, longitude and altitude are enough to begin."
            action={
              <Button size="sm" variant="primary" icon={Plus} onClick={() => setForm({ ...EMPTY })}>
                Add a location
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((location) => {
            const active = location.id === activeLocationId;
            const obstructed = location.horizonMask.filter((v) => v > 2).length;
            return (
              <Panel key={location.id}>
                <PanelHeader
                  title={location.name}
                  subtitle={location.place}
                  icon={MapPin}
                  actions={
                    <div className="flex items-center gap-1">
                      {active && (
                        <Badge tone="primary" size="sm" icon={Check}>
                          Active
                        </Badge>
                      )}
                      {location.isDefault && <Tag mono={false}>default</Tag>}
                      <IconButton
                        icon={Trash2}
                        label={`Remove ${location.name}`}
                        size="sm"
                        onClick={() => setDeleting(location)}
                      />
                    </div>
                  }
                />
                <PanelBody className="space-y-3">
                  <KeyValue
                    dense
                    columns={2}
                    rows={[
                      { label: 'Coordinates', value: latLon(location.latitude, location.longitude, 4) },
                      { label: 'Altitude', value: `${num(location.altitudeM)} m` },
                      { label: 'Timezone', value: location.timezone, mono: false },
                      { label: 'Minimum elevation', value: `${location.minElevationDeg}°` },
                      { label: 'Sky brightness', value: `Bortle ${location.bortleClass}` },
                      { label: 'Obstructed bearings', value: `${obstructed} of 36` },
                    ]}
                  />
                  {location.notes && (
                    <p className="text-xs leading-relaxed text-ink-faint">{location.notes}</p>
                  )}
                  <div>
                    <p className="label-caps mb-1.5">Horizon obstruction mask</p>
                    <HorizonMaskEditor mask={location.horizonMask} readOnly />
                  </div>
                </PanelBody>
                <PanelFooter>
                  {!active && (
                    <Button size="xs" variant="outline" onClick={() => setActiveLocationId(location.id)}>
                      Make active
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      setForm({
                        id: location.id,
                        name: location.name,
                        place: location.place,
                        latitude: String(location.latitude),
                        longitude: String(location.longitude),
                        altitudeM: String(location.altitudeM),
                        bortleClass: String(location.bortleClass),
                        minElevationDeg: String(location.minElevationDeg),
                        notes: location.notes,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={Mountain}
                    className="ml-auto"
                    onClick={() => setMaskFor({ ...location, draft: [...location.horizonMask] })}
                  >
                    Edit mask
                  </Button>
                </PanelFooter>
              </Panel>
            );
          })}
        </div>
      )}

      <InlineNote>
        Observer locations are personal data. They are never included in a share link, never placed
        in a URL, and are deleted with the account.
      </InlineNote>

      {/* ------------------------------------------------------------- form */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit location' : 'Add an observer location'}
        description="Coordinates are decimal degrees, positive north and east."
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" loading={save.pending} onClick={() => save.run()}>
              {form?.id ? 'Save changes' : 'Add location'}
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            {save.error && save.error.code !== 'validation' && <FormError error={save.error} />}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="locName" error={save.fieldErrors?.name} required>
                <Input id="locName" value={form.name} onChange={(e) => set('name')(e.target.value)} placeholder="Rooftop" />
              </Field>
              <Field label="Place" htmlFor="locPlace" hint="Town and country, for your own reference.">
                <Input id="locPlace" value={form.place} onChange={(e) => set('place')(e.target.value)} />
              </Field>
              <Field label="Latitude" htmlFor="lat" error={save.fieldErrors?.latitude} required>
                <Input
                  id="lat"
                  type="number"
                  step="0.0001"
                  value={form.latitude}
                  onChange={(e) => set('latitude')(e.target.value)}
                  suffix="degrees"
                  invalid={!!save.fieldErrors?.latitude}
                />
              </Field>
              <Field label="Longitude" htmlFor="lon" error={save.fieldErrors?.longitude} required>
                <Input
                  id="lon"
                  type="number"
                  step="0.0001"
                  value={form.longitude}
                  onChange={(e) => set('longitude')(e.target.value)}
                  suffix="degrees"
                  invalid={!!save.fieldErrors?.longitude}
                />
              </Field>
              <Field label="Altitude" htmlFor="alt" hint="Metres above sea level.">
                <Input id="alt" type="number" value={form.altitudeM} onChange={(e) => set('altitudeM')(e.target.value)} suffix="m" />
              </Field>
              <Field label="Sky brightness" htmlFor="bortle" hint="Bortle class, 1 is darkest.">
                <Select id="bortle" value={form.bortleClass} onChange={(e) => set('bortleClass')(e.target.value)}>
                  {BORTLE.map(([value, label]) => (
                    <option key={value} value={value}>
                      {value} &mdash; {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Slider
              label="Minimum elevation for this site"
              min={0}
              max={40}
              step={1}
              value={Number(form.minElevationDeg)}
              onChange={(v) => set('minElevationDeg')(String(v))}
              display={`${form.minElevationDeg}°`}
            />

            <Field label="Notes" htmlFor="locNotes" hint="Access, power, what blocks the view.">
              <Textarea id="locNotes" rows={3} value={form.notes} onChange={(e) => set('notes')(e.target.value)} />
            </Field>
          </div>
        )}
      </Modal>

      {/* -------------------------------------------------------- mask editor */}
      <Modal
        open={!!maskFor}
        onClose={() => setMaskFor(null)}
        title={maskFor ? `Horizon mask for ${maskFor.name}` : ''}
        description="Drag each bar to the elevation at which the view clears on that bearing. Thirty-six bars, one per ten degrees of azimuth."
        size="lg"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setMaskFor(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={saveMask.pending}
              onClick={() => saveMask.run(maskFor.id, maskFor.draft)}
            >
              Save mask
            </Button>
          </>
        }
      >
        {maskFor && (
          <div className="space-y-4">
            <HorizonMaskEditor
              mask={maskFor.draft}
              onChange={(next) => setMaskFor((current) => ({ ...current, draft: next }))}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="xs"
                variant="outline"
                onClick={() => setMaskFor((c) => ({ ...c, draft: new Array(36).fill(0) }))}
              >
                Clear to an open horizon
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => setMaskFor((c) => ({ ...c, draft: new Array(36).fill(10) }))}
              >
                Flat 10 degrees all round
              </Button>
            </div>
            <InlineNote>
              A pass is rejected when its maximum elevation falls below the mask on the bearing of
              closest approach. Measuring this honestly is the difference between a plan that works
              and one that sends you outside to look at a wall.
            </InlineNote>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.run(deleting.id)}
        loading={remove.pending}
        title={`Remove ${deleting?.name}?`}
        body="Plans and log entries that reference this site keep their recorded coordinates, but you will not be able to run new scans from it."
        confirmLabel="Remove location"
      />
    </div>
  );
}

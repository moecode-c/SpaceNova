import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Antenna, CircleAlert, Clock, Save, Trash2 } from 'lucide-react';
import { Grid, KeyValue, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, Section, StatTile } from '../../components/ui/panel.jsx';
import { Breadcrumbs } from '../../components/ui/nav.jsx';
import { DataTable } from '../../components/ui/table.jsx';
import { Field, Input, Slider } from '../../components/ui/form.jsx';
import { Badge, Button, IconButton, Tag } from '../../components/ui/primitives.jsx';
import { EmptyState, ErrorState, InlineNote, LoadingState, useToast } from '../../components/ui/feedback.jsx';
import { HorizonMaskEditor } from '../../components/map/PolarChart.jsx';
import { WorldMap } from '../../components/map/WorldMap.jsx';
import { SourceTag } from '../../components/data/source.jsx';
import { BandTags, StatusBadge } from '../../components/data/badges.jsx';
import { useApi, useAction } from '../../hooks/useApi.js';
import { engineering } from '../../api/index.js';
import { age, dateShort, deg, duration, latLon, num, timeShort } from '../../lib/format.js';

export default function StationDetail() {
  const { stationId } = useParams();
  const toast = useToast();
  const { data, meta, loading, error, reload } = useApi(
    () => engineering.stations.get(stationId),
    [stationId],
  );

  const [draft, setDraft] = useState(null);

  const save = useAction((patch) => engineering.stations.update(stationId, patch), {
    onSuccess: () => {
      toast.success('Station updated');
      setDraft(null);
      reload();
    },
  });

  const cancelBooking = useAction((id) => engineering.stations.cancelBooking(id), {
    onSuccess: () => {
      toast.success('Booking cancelled');
      reload();
    },
  });

  if (loading && !data) return <LoadingState label="Loading station" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const { station, bookings } = data;
  const current = draft ?? {
    minElevationDeg: station.minElevationDeg,
    turnaroundMinutes: station.turnaroundMinutes,
    antenna: station.antenna,
    horizonMask: station.horizonMask,
  };
  const dirty = !!draft;
  const conflicts = bookings.filter((b) => b.status === 'conflict');

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Antenna}
        title={station.name}
        breadcrumb={
          <Breadcrumbs
            items={[
              { label: 'Ground stations', to: '/app/engineering/stations' },
              { label: station.name },
            ]}
          />
        }
        description={`${station.location}. ${station.antenna}`}
        meta={
          <>
            <StatusBadge status={station.health} />
            <BandTags bands={station.bands} />
            <Tag mono={false}>{station.ownerName}</Tag>
            {meta && <SourceTag meta={meta} />}
          </>
        }
        actions={
          dirty && (
            <Button size="sm" variant="primary" icon={Save} loading={save.pending} onClick={() => save.run(current)}>
              Save changes
            </Button>
          )
        }
      />

      {station.health !== 'nominal' && (
        <Panel>
          <PanelBody className="flex items-start gap-3">
            <CircleAlert size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden />
            <div>
              <p className="text-xs font-semibold text-ink">{station.healthLabel}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-faint">{station.healthNote}</p>
            </div>
          </PanelBody>
        </Panel>
      )}

      <Grid cols={4}>
        <StatTile label="Bookings" value={num(bookings.length)} icon={Clock} />
        <StatTile
          label="Conflicts"
          value={num(conflicts.length)}
          tone={conflicts.length ? 'warn' : 'good'}
          hint="Overlapping, including the turnaround gap"
        />
        <StatTile label="Minimum elevation" value={`${current.minElevationDeg}°`} hint="Below this the rotator is not tasked" />
        <StatTile label="Turnaround" value={`${current.turnaroundMinutes} min`} hint="Minimum gap between consecutive passes" />
      </Grid>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Configuration" icon={Antenna} />
          <PanelBody className="space-y-4">
            <Field label="Antenna" htmlFor="antenna">
              <Input
                id="antenna"
                value={current.antenna}
                onChange={(e) => setDraft({ ...current, antenna: e.target.value })}
              />
            </Field>
            <Slider
              label="Minimum elevation"
              min={0}
              max={45}
              step={1}
              value={current.minElevationDeg}
              onChange={(v) => setDraft({ ...current, minElevationDeg: v })}
              display={`${current.minElevationDeg}°`}
            />
            <Slider
              label="Turnaround gap"
              min={0}
              max={15}
              step={1}
              value={current.turnaroundMinutes}
              onChange={(v) => setDraft({ ...current, turnaroundMinutes: v })}
              display={`${current.turnaroundMinutes} min`}
            />
            <KeyValue
              dense
              columns={2}
              rows={[
                { label: 'Coordinates', value: latLon(station.latitude, station.longitude, 4) },
                { label: 'Altitude', value: `${num(station.altitudeM)} m` },
                { label: 'Gain', value: `${num(station.gainDbi)} dBi` },
                { label: 'Noise figure', value: `${num(station.noiseFigureDb, 2)} dB` },
                { label: 'Slew rate', value: `${num(station.slewRateDegPerSec, 1)} deg/s` },
                { label: 'Last calibrated', value: age(station.lastCalibratedAt) },
              ]}
            />
          </PanelBody>
          <PanelFooter>
            <InlineNote>
              Changing the minimum elevation or the turnaround gap changes which bookings conflict,
              so the schedule is re-resolved the next time it is drawn.
            </InlineNote>
          </PanelFooter>
        </Panel>

        <div className="space-y-3">
          <Panel>
            <PanelHeader title="Location" />
            <PanelBody padded={false}>
              <WorldMap
                mode="flat"
                height={200}
                stations={[{ id: station.id, latitude: station.latitude, longitude: station.longitude }]}
                observer={{ latitude: station.latitude, longitude: station.longitude, name: station.name }}
                showFootprints={false}
                interactive={false}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Horizon mask"
              subtitle="Obstruction elevation on each bearing. Drag a bar to change it."
            />
            <PanelBody>
              <HorizonMaskEditor
                mask={current.horizonMask}
                onChange={(next) => setDraft({ ...current, horizonMask: next })}
              />
            </PanelBody>
          </Panel>
        </div>
      </div>

      <Section
        title="Bookings"
        description="Scheduled passes for this station. Conflicts are flagged rather than silently dropped."
      >
        <Panel>
          <DataTable
            rowKey={(b) => b.id}
            columns={[
              {
                key: 'startsAt',
                header: 'Window (UTC)',
                render: (b) => (
                  <div>
                    <p className="tnum font-mono text-ink">
                      {dateShort(b.startsAt)} {timeShort(b.startsAt, true)}
                    </p>
                    <p className="text-2xs text-ink-faint">to {timeShort(b.endsAt, true)}</p>
                  </div>
                ),
              },
              {
                key: 'objectName',
                header: 'Object',
                nowrap: false,
                render: (b) => (
                  <Link to={`/catalog/${b.objectId}`} className="text-ink hover:text-primary-bright">
                    {b.objectName}
                  </Link>
                ),
              },
              { key: 'purpose', header: 'Purpose', hideBelow: 'md' },
              { key: 'band', header: 'Band', render: (b) => <Tag>{b.band}</Tag> },
              { key: 'maxElevationDeg', header: 'Max elevation', align: 'right', mono: true, render: (b) => deg(b.maxElevationDeg, 1) },
              { key: 'durationMinutes', header: 'Duration', align: 'right', mono: true, render: (b) => duration(b.durationMinutes * 60) },
              {
                key: 'status',
                header: 'Status',
                render: (b) => (
                  <Badge
                    tone={b.status === 'conflict' ? 'warn' : b.status === 'tentative' ? 'default' : 'good'}
                    size="sm"
                  >
                    {b.status}
                  </Badge>
                ),
              },
              {
                key: 'cancel',
                header: '',
                align: 'right',
                render: (b) => (
                  <IconButton
                    icon={Trash2}
                    label={`Cancel booking for ${b.objectName}`}
                    size="xs"
                    onClick={() => cancelBooking.run(b.id)}
                  />
                ),
              },
            ]}
            rows={bookings}
            empty={
              <EmptyState
                compact
                icon={Clock}
                title="No bookings"
                description="Nothing is scheduled on this station."
              />
            }
          />
        </Panel>
      </Section>
    </div>
  );
}

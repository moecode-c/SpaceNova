import { Link } from 'react-router-dom';
import { Antenna, ArrowRight, CircleAlert, Gauge, Radio, Signal } from 'lucide-react';
import { Grid, KeyValue, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, Meter } from '../../components/ui/panel.jsx';
import { Badge, Tag } from '../../components/ui/primitives.jsx';
import { StatTile } from '../../components/ui/panel.jsx';
import { EmptyState, InlineNote, LoadingState } from '../../components/ui/feedback.jsx';
import { WorldMap } from '../../components/map/WorldMap.jsx';
import { HorizonMaskEditor } from '../../components/map/PolarChart.jsx';
import { SourceTag } from '../../components/data/source.jsx';
import { BandTags, StatusBadge } from '../../components/data/badges.jsx';
import { useApi } from '../../hooks/useApi.js';
import { engineering } from '../../api/index.js';
import { age, latLon, num, percent } from '../../lib/format.js';

export default function Stations() {
  const { data, meta, loading } = useApi(() => engineering.stations.list(), []);
  const rows = data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Antenna}
        title="Ground stations"
        description="Antenna sites you operate, with their bands, pointing limits, horizon masks and booking load."
        meta={meta ? <SourceTag meta={meta} /> : null}
      />

      <Grid cols={4}>
        <StatTile label="Stations" value={num(rows.length)} icon={Antenna} />
        <StatTile
          label="Nominal"
          value={num(rows.filter((s) => s.health === 'nominal').length)}
          tone="good"
          hint="All subsystems reporting"
        />
        <StatTile
          label="Degraded or offline"
          value={num(rows.filter((s) => s.health !== 'nominal').length)}
          tone={rows.some((s) => s.health !== 'nominal') ? 'warn' : 'default'}
          icon={CircleAlert}
        />
        <StatTile
          label="Open conflicts"
          value={num(rows.reduce((n, s) => n + s.conflictCount, 0))}
          tone={rows.some((s) => s.conflictCount) ? 'warn' : 'default'}
          hint="Overlapping bookings awaiting resolution"
        />
      </Grid>

      {rows.length > 0 && (
        <Panel>
          <PanelHeader title="Station network" subtitle="Each marker is a configured site." icon={Signal} />
          <PanelBody padded={false}>
            <WorldMap
              mode="flat"
              height={280}
              stations={rows.map((s) => ({ id: s.id, latitude: s.latitude, longitude: s.longitude }))}
              showFootprints={false}
              interactive={false}
            />
          </PanelBody>
        </Panel>
      )}

      {loading && rows.length === 0 ? (
        <Panel>
          <LoadingState label="Loading stations" />
        </Panel>
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Antenna}
            title="No ground stations"
            description="Stations are created by the Engineer role. In Phase 2 this screen also creates them."
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((station) => (
            <Panel key={station.id}>
              <PanelHeader
                title={station.name}
                subtitle={station.location}
                icon={Antenna}
                actions={<StatusBadge status={station.health} />}
              />
              <PanelBody className="space-y-3">
                <KeyValue
                  dense
                  columns={2}
                  rows={[
                    { label: 'Coordinates', value: latLon(station.latitude, station.longitude, 3) },
                    { label: 'Altitude', value: `${num(station.altitudeM)} m` },
                    { label: 'Minimum elevation', value: `${station.minElevationDeg}°` },
                    { label: 'Turnaround', value: `${station.turnaroundMinutes} min` },
                    { label: 'Gain', value: `${num(station.gainDbi)} dBi` },
                    { label: 'Noise figure', value: `${num(station.noiseFigureDb, 2)} dB` },
                    { label: 'Slew rate', value: `${num(station.slewRateDegPerSec, 1)} deg/s` },
                    { label: 'Last calibrated', value: age(station.lastCalibratedAt) },
                  ]}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <BandTags bands={station.bands} />
                  <Tag mono={false}>{station.bookingCount} bookings</Tag>
                  {station.conflictCount > 0 && (
                    <Badge tone="warn" size="sm" icon={CircleAlert}>
                      {station.conflictCount} conflicts
                    </Badge>
                  )}
                </div>

                <p className="text-xs leading-relaxed text-ink-faint">{station.antenna}</p>

                <Meter
                  value={station.utilisation}
                  tone={station.utilisation > 0.75 ? 'warn' : 'primary'}
                  label="Scheduled utilisation"
                  right={percent(station.utilisation)}
                />

                <div>
                  <p className="label-caps mb-1.5">Horizon mask</p>
                  <HorizonMaskEditor mask={station.horizonMask} readOnly />
                </div>

                {station.health !== 'nominal' && (
                  <div className="panel-inset flex items-start gap-2.5 p-2.5">
                    <CircleAlert size={13} className="mt-0.5 shrink-0 text-warn" aria-hidden />
                    <p className="text-2xs leading-relaxed text-ink-faint">{station.healthNote}</p>
                  </div>
                )}
              </PanelBody>
              <PanelFooter>
                <Tag mono={false}>{station.ownerName}</Tag>
                <Link
                  to={`/app/engineering/stations/${station.id}`}
                  className="link ml-auto inline-flex items-center gap-1 text-2xs"
                >
                  Open station
                  <ArrowRight size={11} aria-hidden />
                </Link>
              </PanelFooter>
            </Panel>
          ))}
        </div>
      )}

      <Panel>
        <PanelHeader title="Why the mask matters twice" icon={Gauge} />
        <PanelBody className="space-y-2.5">
          <InlineNote icon={Radio}>
            For visual observation the mask decides whether you can see the object. For a radio
            station it decides whether the antenna has line of sight, and a pass that clips the
            mask produces a broken Doppler curve rather than no signal at all.
          </InlineNote>
          <InlineNote>
            The station minimum elevation is usually higher than an observer's, because below it
            the slant range is long, the signal is weak and the rotator is slewing fastest.
          </InlineNote>
        </PanelBody>
      </Panel>
    </div>
  );
}

import { useParams } from 'react-router-dom';
import { CalendarClock, MapPin, Orbit, Rocket, Timer, Video } from 'lucide-react';
import { Grid, KeyValue, PageHeader, Panel, PanelBody, PanelHeader, StatTile } from '../../components/ui/panel.jsx';
import { Breadcrumbs } from '../../components/ui/nav.jsx';
import { Badge, Button, Tag } from '../../components/ui/primitives.jsx';
import { ErrorState, LoadingState } from '../../components/ui/feedback.jsx';
import { SourceTag, FixtureNotice } from '../../components/data/source.jsx';
import { WorldMap } from '../../components/map/WorldMap.jsx';
import { useApi, useClock } from '../../hooks/useApi.js';
import { launches as launchesApi } from '../../api/index.js';
import { age, dateTime, duration, km, latLon, num, titleCase } from '../../lib/format.js';

export default function LaunchDetail() {
  const { launchId } = useParams();
  const now = useClock(1000);
  const { data, meta, loading, error, reload } = useApi(() => launchesApi.get(launchId), [launchId]);

  if (loading && !data) return <LoadingState label="Loading launch record" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const { launch } = data;
  const seconds = (new Date(launch.net).getTime() - now.getTime()) / 1000;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Rocket}
        title={launch.payloadName}
        breadcrumb={
          <Breadcrumbs
            items={[
              { label: 'Launches', to: '/launches' },
              { label: launch.provider, to: '/launches' },
              { label: launch.payloadName },
            ]}
          />
        }
        description={launch.description}
        meta={
          <>
            <Badge tone={launch.statusTone} dot>
              {launch.statusLabel}
            </Badge>
            <Tag>{launch.vehicle}</Tag>
            <Tag>{launch.destination}</Tag>
            {launch.reused && <Tag mono={false}>flight-proven booster</Tag>}
            {meta && <SourceTag meta={meta} />}
          </>
        }
        actions={
          launch.webcast && (
            <Button size="sm" variant="secondary" icon={Video} disabled>
              Webcast link in Phase 2
            </Button>
          )
        }
      />

      <Grid cols={4}>
        <StatTile
          label={seconds > 0 ? 'Time to launch' : 'Time since launch'}
          value={duration(Math.abs(seconds))}
          hint={dateTime(launch.net, true) + ' UTC'}
          icon={Timer}
          tone={seconds > 0 ? 'primary' : 'default'}
        />
        <StatTile
          label="Window"
          value={launch.windowMinutes ? `${launch.windowMinutes} min` : 'Instantaneous'}
          hint={launch.windowMinutes ? 'From the opening of the window' : 'A single committed instant'}
          icon={CalendarClock}
        />
        <StatTile
          label="Payload mass"
          value={num(launch.payloadMassKg)}
          unit="kg"
          hint={titleCase(launch.payloadKind)}
        />
        <StatTile
          label="Target orbit"
          value={km(launch.orbitTargetKm, 0)}
          hint={launch.destination}
          icon={Orbit}
        />
      </Grid>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Flight record" icon={Rocket} />
          <PanelBody>
            <KeyValue
              rows={[
                { label: 'Provider', value: launch.provider, mono: false },
                { label: 'Provider country', value: launch.providerCountry, mono: false },
                { label: 'Vehicle', value: launch.vehicle, mono: false },
                { label: 'Pad', value: launch.padName, mono: false },
                { label: 'Site', value: launch.padLocation, mono: false },
                { label: 'Coordinates', value: latLon(launch.padLatitude, launch.padLongitude, 4) },
                { label: 'No earlier than', value: `${dateTime(launch.net, true)} UTC` },
                {
                  label: 'Window closes',
                  value: launch.windowClose ? `${dateTime(launch.windowClose, true)} UTC` : 'not applicable',
                },
                { label: 'Status', value: launch.statusLabel, mono: false },
                {
                  label: 'Confidence',
                  value: launch.probability === null ? 'not published' : `${launch.probability}%`,
                },
                { label: 'Record updated', value: age(launch.updatedAt) },
              ]}
            />
          </PanelBody>
        </Panel>

        <div className="space-y-3">
          <Panel>
            <PanelHeader title="Launch site" icon={MapPin} />
            <PanelBody padded={false}>
              <WorldMap
                mode="flat"
                height={240}
                pads={[{ id: launch.id, latitude: launch.padLatitude, longitude: launch.padLongitude }]}
                observer={{ latitude: launch.padLatitude, longitude: launch.padLongitude, name: launch.padName }}
                showFootprints={false}
                interactive={false}
              />
            </PanelBody>
          </Panel>

        </div>
      </div>

      <FixtureNotice compact />
    </div>
  );
}

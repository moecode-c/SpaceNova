import { useEffect, useState } from 'react';
import { Gauge, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import { Grid, KeyValue, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, Section, StatTile } from '../../components/ui/panel.jsx';
import { Field, Input, Slider, Switch } from '../../components/ui/form.jsx';
import { Button, Tag } from '../../components/ui/primitives.jsx';
import { Banner, InlineNote, LoadingState, useToast } from '../../components/ui/feedback.jsx';
import { SourceTag } from '../../components/data/source.jsx';
import { useApi, useAction } from '../../hooks/useApi.js';
import { admin } from '../../api/index.js';
import { DEFAULTS } from '../../engine/defaults.js';
import { num } from '../../lib/format.js';

export default function AdminSettings() {
  const toast = useToast();
  const settings = useApi(() => admin.settings(), []);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (settings.data && !draft) setDraft(structuredClone(settings.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.data]);

  const save = useAction(() => admin.updateSettings(draft), {
    onSuccess: () => {
      toast.success('Thresholds saved', 'Every later computation uses the new values.');
      settings.refetch();
    },
  });

  if (settings.loading && !draft) return <LoadingState label="Loading thresholds" />;
  if (!draft) return null;

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const setNested = (key, sub, value) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], [sub]: value } }));

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.data);
  const changedFromDefault = Object.entries(DEFAULTS).filter(
    ([key, value]) => typeof value !== 'object' && draft[key] !== value,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Gauge}
        title="Platform thresholds"
        description="The values the engine uses. They are stored as data, so changing one here changes every later prediction without a rebuild."
        meta={
          <>
            {changedFromDefault.length > 0 && (
              <Tag mono={false}>{changedFromDefault.length} changed from the default</Tag>
            )}
            {settings.meta && <SourceTag meta={settings.meta} />}
          </>
        }
        actions={
          <>
            <Button
              size="sm"
              variant="ghost"
              icon={RotateCcw}
              onClick={() => setDraft(structuredClone(DEFAULTS))}
            >
              Restore defaults
            </Button>
            <Button size="sm" variant="primary" icon={Save} disabled={!dirty} loading={save.pending} onClick={() => save.run()}>
              Save thresholds
            </Button>
          </>
        }
      />

      {dirty && (
        <Banner tone="warn" title="Unsaved changes">
          These values are not in force until you save. Existing dataset snapshots keep the
          thresholds they were frozen with and are unaffected either way.
        </Banner>
      )}

      <Grid cols={4}>
        <StatTile label="Minimum elevation" value={`${draft.minElevationDeg}°`} icon={SlidersHorizontal} />
        <StatTile label="Twilight threshold" value={`${draft.twilightThresholdDeg}°`} />
        <StatTile label="Propagation horizon" value={`${draft.propagationHorizonDays} d`} />
        <StatTile label="Turnaround gap" value={`${draft.turnaroundMinutes} min`} />
      </Grid>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Pass detection"
            subtitle="How the horizon is scanned and how precisely each crossing is pinned down."
            icon={SlidersHorizontal}
          />
          <PanelBody className="space-y-4">
            <Slider
              label="Minimum elevation"
              min={0}
              max={40}
              step={1}
              value={draft.minElevationDeg}
              onChange={(v) => set('minElevationDeg', v)}
              display={`${draft.minElevationDeg}°`}
            />
            <Slider
              label="Coarse scan step"
              min={5}
              max={120}
              step={5}
              value={draft.coarseStepSeconds}
              onChange={(v) => set('coarseStepSeconds', v)}
              display={`${draft.coarseStepSeconds} s`}
            />
            <Slider
              label="Refinement tolerance"
              min={1}
              max={30}
              step={1}
              value={draft.refineToleranceSeconds}
              onChange={(v) => set('refineToleranceSeconds', v)}
              display={`${draft.refineToleranceSeconds} s`}
            />
            <InlineNote>
              A coarser scan is faster but can miss a short, low pass entirely. A step longer than
              the shortest pass you care about is a silent loss, not a slower result.
            </InlineNote>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Visibility"
            subtitle="The clauses that decide whether a pass above the horizon counts as visible."
          />
          <PanelBody className="space-y-4">
            <Slider
              label="Twilight threshold"
              min={-18}
              max={0}
              step={1}
              value={draft.twilightThresholdDeg}
              onChange={(v) => set('twilightThresholdDeg', v)}
              display={`${draft.twilightThresholdDeg}°`}
            />
            <Switch
              checked={draft.requireIllumination}
              onChange={(v) => set('requireIllumination', v)}
              label="Require the object to be sunlit"
              description="Turning this off lists eclipsed passes as visible, which is only correct for radio work."
            />
            <Switch
              checked={draft.applyHorizonMask}
              onChange={(v) => set('applyHorizonMask', v)}
              label="Apply the horizon obstruction mask"
              description="Turning this off ignores the measured obstruction profile of each site."
            />
            <InlineNote>
              Civil twilight is -6 degrees, nautical is -12 and astronomical is -18. The default of
              -12 is a deliberate compromise: stricter than most trackers, but not so strict that
              usable evening passes disappear.
            </InlineNote>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Element-set freshness" subtitle="Where each band begins, and what the engine refuses." />
          <PanelBody className="space-y-4">
            <Field label="Fresh band, hours" htmlFor="fresh">
              <Input
                id="fresh"
                type="number"
                value={draft.freshness.freshHours}
                onChange={(e) => setNested('freshness', 'freshHours', Number(e.target.value))}
                suffix="h"
              />
            </Field>
            <Field label="Usable band, hours" htmlFor="usable">
              <Input
                id="usable"
                type="number"
                value={draft.freshness.usableHours}
                onChange={(e) => setNested('freshness', 'usableHours', Number(e.target.value))}
                suffix="h"
              />
            </Field>
            <Slider
              label="Propagation horizon"
              min={1}
              max={30}
              step={1}
              value={draft.propagationHorizonDays}
              onChange={(v) => set('propagationHorizonDays', v)}
              display={`${draft.propagationHorizonDays} days`}
            />
            <InlineNote>
              Beyond the horizon the engine refuses to predict rather than extrapolating. That
              refusal is reported to the user with the object named, not hidden.
            </InlineNote>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Scheduling and retention" />
          <PanelBody className="space-y-4">
            <Slider
              label="Turnaround gap"
              min={0}
              max={15}
              step={1}
              value={draft.turnaroundMinutes}
              onChange={(v) => set('turnaroundMinutes', v)}
              display={`${draft.turnaroundMinutes} min`}
            />
            <Slider
              label="Telemetry retention"
              min={1}
              max={180}
              step={1}
              value={draft.telemetryRetentionDays}
              onChange={(v) => set('telemetryRetentionDays', v)}
              display={`${draft.telemetryRetentionDays} days`}
            />
            <Slider
              label="Degraded mode limit"
              min={1}
              max={168}
              step={1}
              value={draft.degradedModeLimitHours}
              onChange={(v) => set('degradedModeLimitHours', v)}
              display={`${draft.degradedModeLimitHours} h`}
            />
            <InlineNote>
              Past the degraded-mode limit a cached value is reported as unavailable rather than
              shown with a banner, because at that age it is no longer informative.
            </InlineNote>
          </PanelBody>
        </Panel>
      </div>

      <Section title="Pass quality score weights" description="Relative weights. They are renormalised before use, so they do not have to sum to one.">
        <Panel>
          <PanelBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(draft.scoreWeights).map(([key, value]) => (
              <Slider
                key={key}
                label={key.replace(/([A-Z])/g, ' $1')}
                min={0}
                max={1}
                step={0.01}
                value={value}
                onChange={(v) => setNested('scoreWeights', key, v)}
                display={num(value, 2)}
              />
            ))}
          </PanelBody>
          <PanelFooter>
            <InlineNote>
              Raising the illumination weight pushes bright evening passes up the ranking. Raising
              the freshness weight makes the planner distrust stale element sets more sharply.
            </InlineNote>
          </PanelFooter>
        </Panel>
      </Section>

      <Panel>
        <PanelHeader title="Cache time to live, per source kind" />
        <PanelBody>
          <KeyValue
            columns={2}
            rows={Object.entries(draft.cacheTtlMinutes).map(([key, value]) => ({
              label: key.replace(/([A-Z])/g, ' $1'),
              value: `${value} min`,
            }))}
          />
        </PanelBody>
        <PanelFooter>
          <Tag mono={false}>Every change here is written to the audit log</Tag>
        </PanelFooter>
      </Panel>
    </div>
  );
}

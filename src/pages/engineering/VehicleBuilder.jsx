import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowDown, ArrowUp, Blocks, CheckCircle2, Flame, Fuel, Gauge,
  Info, Layers, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  Plus, Rocket, Ruler, Save, Trash2, Weight, X,
} from 'lucide-react';
import { KeyValue, Meter, Panel, PanelBody, PanelHeader } from '../../components/ui/panel.jsx';
import { SideList } from '../../components/ui/nav.jsx';
import { Field, Input, SearchInput, Textarea } from '../../components/ui/form.jsx';
import { Badge, Button, TONES } from '../../components/ui/primitives.jsx';
import { ConfirmDialog, Tooltip } from '../../components/ui/overlay.jsx';
import { InlineNote, LoadingState, useToast } from '../../components/ui/feedback.jsx';
import { RocketScale } from '../../components/vehicle/RocketScale.jsx';
import { PartGlyph } from '../../components/vehicle/part-shapes.jsx';
import { useApi, useAction } from '../../hooks/useApi.js';
import { engineering } from '../../api/index.js';
import { analyseVehicle, verdictFor, G0 } from '../../engine/vehicle.js';
import { vehicleGeometry } from '../../engine/vehicle-geometry.js';
import { cn } from '../../lib/cn.js';
import { num, duration, percent } from '../../lib/format.js';

/** Tonnes when the number is large enough to deserve them, kilograms below. */
function mass(kg) {
  if (kg === null || kg === undefined) return '-';
  if (kg >= 1000) return `${num(kg / 1000, kg >= 100000 ? 0 : 1)} t`;
  return `${num(kg, 0)} kg`;
}

/** Kilonewtons. Thrust in newtons is unreadable at launch-vehicle scale. */
function thrust(n) {
  if (!n) return '-';
  return `${num(n / 1000, n >= 1_000_000 ? 0 : 1)} kN`;
}

const kms = (ms) => `${num(ms / 1000, 2)} km/s`;

const KIND_ICON = {
  engine: Flame,
  tank: Fuel,
  booster: Rocket,
  interstage: Layers,
  fairing: Blocks,
  adapter: Blocks,
  payload: Weight,
};

/* ------------------------------------------------------------------ */

/** One figure in the heads-up strip along the top of the workspace. */
function Readout({ label, value, unit, tone = 'default', hint, icon: Icon, className }) {
  return (
    <Tooltip label={hint}>
      <div
        className={cn(
          'flex min-w-0 items-center gap-2 border-l border-line/70 px-3 first:border-0',
          className,
        )}
      >
        {Icon && <Icon size={13} className="shrink-0 text-ink-faint" aria-hidden />}
        <div className="min-w-0">
          <p className="label-caps truncate leading-none">{label}</p>
          <p className="mt-1 flex items-baseline gap-1 leading-none">
            <span
              className={cn(
                'tnum font-mono text-sm font-semibold',
                tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-ink',
              )}
            >
              {value}
            </span>
            {unit && <span className="text-2xs text-ink-faint">{unit}</span>}
          </p>
        </div>
      </div>
    </Tooltip>
  );
}

/** One draggable component in the library. */
function PaletteCard({ component, onAdd, onDragStart, onDragEnd, dragging }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-spacenova-component', component.id);
        e.dataTransfer.effectAllowed = 'copy';
        onDragStart(component);
      }}
      onDragEnd={onDragEnd}
      onDoubleClick={() => onAdd(component.id)}
      className={cn(
        'group flex cursor-grab items-start gap-2.5 rounded-md border border-line bg-surface/70 p-2 transition-all',
        'hover:border-primary-dim/70 hover:bg-surface active:cursor-grabbing',
        dragging && 'opacity-40',
      )}
    >
      <div className="shrink-0 rounded border border-line/70 bg-void/60 p-0.5">
        <PartGlyph component={component} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-ink">{component.name}</p>
        <p className="truncate text-2xs text-ink-faint">{component.maker}</p>
        <dl className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-2xs text-ink-faint">
          {component.thrustVacN > 0 && (
            <div>
              <dt className="inline">T </dt>
              <dd className="tnum inline font-mono text-ink-dim">
                {thrust(component.thrustSlN || component.thrustVacN)}
              </dd>
            </div>
          )}
          {component.ispVacS > 0 && (
            <div>
              <dt className="inline">Isp </dt>
              <dd className="tnum inline font-mono text-ink-dim">{component.ispVacS}s</dd>
            </div>
          )}
          {component.propellantMassKg > 0 ? (
            <div>
              <dt className="inline">Prop </dt>
              <dd className="tnum inline font-mono text-ink-dim">
                {mass(component.propellantMassKg)}
              </dd>
            </div>
          ) : (
            <div>
              <dt className="inline">m </dt>
              <dd className="tnum inline font-mono text-ink-dim">{mass(component.dryMassKg)}</dd>
            </div>
          )}
          <div>
            <dt className="inline">⌀ </dt>
            <dd className="tnum inline font-mono text-ink-dim">{num(component.diameterM, 2)}m</dd>
          </div>
        </dl>
      </div>

      <Button
        size="xs"
        variant="ghost"
        icon={Plus}
        className="shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        onClick={() => onAdd(component.id)}
        aria-label={`Add ${component.name} to the stack`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

let slotCounter = 0;
const nextSlotId = () => `slot-${Date.now()}-${(slotCounter += 1)}`;

export default function VehicleBuilder() {
  const { designId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const library = useApi(() => engineering.vehicles.components(), []);
  const designs = useApi(() => engineering.vehicles.list(), []);

  const [stack, setStack] = useState([]);
  const [name, setName] = useState('Untitled design');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [dirty, setDirty] = useState(false);

  const [kindFilter, setKindFilter] = useState('engine');
  const [query, setQuery] = useState('');
  const [dragging, setDragging] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [rightTab, setRightTab] = useState('analysis');
  /*
   * Both side panels collapse, so the pad can take the whole window. Below the
   * large breakpoint they overlay it instead of squeezing it, which is the
   * only way a 1,024-pixel window fits a library, a canvas and an analysis.
   */
  const [showLibrary, setShowLibrary] = useState(true);
  /*
   * Below the extra-large breakpoint the analysis panel overlays the pad
   * rather than sitting beside it, and two overlays would leave no canvas to
   * work on. So it starts closed on a narrow window and the user opens it
   * when they want it.
   */
  const [showAnalysis, setShowAnalysis] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 1280,
  );
  const expanded = !showLibrary && !showAnalysis;

  /*
   * Expand gives the pad the whole window. It also asks for real fullscreen,
   * which a browser may refuse (an embedded frame without the permission, for
   * one), so the panel collapse is what actually does the work and fullscreen
   * is a bonus on top. The button never does nothing.
   */
  const toggleExpand = useCallback(() => {
    const next = !expanded;
    setShowLibrary(!next);
    setShowAnalysis(!next);
    const frame = document.querySelector('[data-pad-frame]');
    if (next) frame?.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, [expanded]);
  const [confirmNew, setConfirmNew] = useState(false);
  const [removing, setRemoving] = useState(null);

  const componentsById = useMemo(() => {
    const map = new Map();
    (library.data?.components ?? []).forEach((c) => map.set(c.id, c));
    return map;
  }, [library.data]);

  const loaded = useApi(() => engineering.vehicles.get(designId), [designId], {
    enabled: !!designId,
  });

  useEffect(() => {
    if (!loaded.data) return;
    const { design } = loaded.data;
    setStack(design.stack.map((e) => ({ ...e, slotId: e.slotId ?? nextSlotId() })));
    setName(design.name);
    setNotes(design.notes ?? '');
    setEditingId(design.id);
    setSelectedSlot(null);
    setDirty(false);
  }, [loaded.data]);

  const parts = useMemo(
    () =>
      stack
        .map((entry) => {
          const component = componentsById.get(entry.componentId);
          if (!component) return null;
          return { ...component, slotId: entry.slotId, count: Math.max(1, entry.count ?? 1) };
        })
        .filter(Boolean),
    [stack, componentsById],
  );

  const analysis = useMemo(() => analyseVehicle(parts), [parts]);
  const verdict = verdictFor(analysis);
  const { layout, cog, cop, stability } = useMemo(() => vehicleGeometry(parts), [parts]);

  /*
   * Acceleration off the pad, net of gravity. Thrust-to-weight is the ratio;
   * this is what is left over to accelerate with, which is the number that
   * decides whether the vehicle moves.
   */
  const padAccelG = analysis.liftoffTwr ? analysis.liftoffTwr - 1 : null;
  const selected = parts.find((p) => p.slotId === selectedSlot) ?? null;

  /* ---- stack editing ------------------------------------------------- */

  const insert = useCallback((componentId, index) => {
    if (!componentId) return;
    const slotId = nextSlotId();
    setStack((prev) => {
      const next = [...prev];
      next.splice(Math.max(0, Math.min(next.length, index)), 0, { slotId, componentId, count: 1 });
      return next;
    });
    setSelectedSlot(slotId);
    setDirty(true);
  }, []);

  const append = useCallback(
    (componentId) => insert(componentId, stack.length),
    [insert, stack.length],
  );

  const moveSlot = useCallback((slotId, to) => {
    setStack((prev) => {
      const from = prev.findIndex((e) => e.slotId === slotId);
      if (from < 0) return prev;
      const next = [...prev];
      const [entry] = next.splice(from, 1);
      // Dropping above where it came from closes the gap the splice left.
      const target = to > from ? to - 1 : to;
      next.splice(Math.max(0, Math.min(next.length, target)), 0, entry);
      return next;
    });
    setDirty(true);
  }, []);

  const nudge = useCallback((slotId, delta) => {
    setStack((prev) => {
      const from = prev.findIndex((e) => e.slotId === slotId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
    setDirty(true);
  }, []);

  const remove = useCallback(
    (slotId) => {
      setStack((prev) => prev.filter((e) => e.slotId !== slotId));
      if (selectedSlot === slotId) setSelectedSlot(null);
      setDirty(true);
    },
    [selectedSlot],
  );

  const setCount = useCallback((slotId, count) => {
    if (count < 1 || count > 40) return;
    setStack((prev) => prev.map((e) => (e.slotId === slotId ? { ...e, count } : e)));
    setDirty(true);
  }, []);

  /* ---- saving -------------------------------------------------------- */

  const startFresh = useCallback(() => {
    setStack([]);
    setName('Untitled design');
    setNotes('');
    setEditingId(null);
    setSelectedSlot(null);
    setDirty(false);
    setConfirmNew(false);
    navigate('/app/engineering/vehicles', { replace: true });
  }, [navigate]);

  const save = useAction(
    () => engineering.vehicles.save({ id: editingId, name, notes, stack }),
    {
      onSuccess: (design) => {
        setEditingId(design.id);
        setDirty(false);
        designs.refetch();
        toast.success('Design saved', `"${design.name}" is in your saved designs.`);
        if (design.id !== designId) {
          navigate(`/app/engineering/vehicles/${design.id}`, { replace: true });
        }
      },
      onError: (error) => toast.error('Could not save the design', error.message),
    },
  );

  const destroy = useAction((id) => engineering.vehicles.remove(id), {
    onSuccess: () => {
      const wasOpen = removing === editingId;
      setRemoving(null);
      designs.refetch();
      toast.success('Design deleted');
      if (wasOpen) startFresh();
    },
  });

  /* ---- library ------------------------------------------------------- */

  const kinds = library.data?.kinds ?? {};
  const visibleComponents = useMemo(() => {
    const all = library.data?.components ?? [];
    const q = query.trim().toLowerCase();
    if (q) {
      return all.filter((c) =>
        `${c.name} ${c.maker} ${c.propellant ?? ''}`.toLowerCase().includes(q),
      );
    }
    return all.filter((c) => c.kind === kindFilter);
  }, [library.data, kindFilter, query]);

  if (library.loading && !library.data) {
    return <LoadingState label="Loading the component library" />;
  }

  const errors = analysis.findings.filter((f) => f.level === 'error');
  const warnings = analysis.findings.filter((f) => f.level === 'warn');
  const infos = analysis.findings.filter((f) => f.level === 'info');
  const findings = [...errors, ...warnings, ...infos];

  return (
    <div className="flex h-full flex-col bg-base">
      {/* ================= heads-up strip ================= */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-surface/60 px-3 py-2">
        <div className="flex min-w-0 shrink-0 items-center gap-1.5">
          <Button
            size="xs"
            variant="ghost"
            icon={showLibrary ? PanelLeftClose : PanelLeftOpen}
            onClick={() => setShowLibrary((v) => !v)}
            aria-label={showLibrary ? 'Hide the component library' : 'Show the component library'}
          />
          <Blocks size={15} className="shrink-0 text-primary" aria-hidden />
          <h1 className="truncate font-sans text-cap text-ink">Vehicle builder</h1>
        </div>

        {verdict && (
          <Badge
            tone={verdict.tone}
            size="sm"
            className="hidden max-w-[14rem] shrink-0 truncate whitespace-nowrap md:inline-flex"
            icon={
              verdict.tone === 'good'
                ? CheckCircle2
                : verdict.tone === 'bad'
                  ? AlertTriangle
                  : Info
            }
          >
            {verdict.label}
          </Badge>
        )}

        <div className="ml-auto flex min-w-0 items-center overflow-x-auto">
          <Readout
            label="Velocity change"
            value={num(analysis.totalDeltaVMs / 1000, 2)}
            unit="km/s"
            icon={Gauge}
            tone={verdict?.tone === 'good' ? 'good' : verdict?.tone === 'bad' ? 'bad' : 'default'}
            hint={verdict ? `${verdict.label}. ${verdict.detail}` : 'Nothing on the pad yet'}
          />
          <Readout
            label="Lift-off thrust"
            value={analysis.liftoffThrustN ? num(analysis.liftoffThrustN / 1000, 0) : '-'}
            unit="kN"
            icon={Flame}
            hint={
              analysis.liftoffTwr
                ? `Thrust-to-weight ${num(analysis.liftoffTwr, 2)} at ignition`
                : 'No first-stage engine yet'
            }
            tone={analysis.liftoffTwr && analysis.liftoffTwr < 1 ? 'bad' : 'default'}
          />
          <Readout
            className="hidden xl:flex"
            label="Height"
            value={layout.totalLengthM ? num(layout.totalLengthM, 1) : '-'}
            unit="m"
            icon={Ruler}
            hint={
              layout.maxDiameterM
                ? `${num(layout.maxDiameterM, 2)} m across at its widest`
                : 'Nothing on the pad yet'
            }
          />
          <Readout
            className="hidden 2xl:flex"
            label="Gross mass"
            value={analysis.grossMassKg ? num(analysis.grossMassKg / 1000, 1) : '-'}
            unit="t"
            icon={Weight}
            hint={`${mass(analysis.propellantMassKg)} of it propellant`}
          />
          <Readout
            className="hidden 2xl:flex"
            label="Payload"
            value={analysis.payloadMassKg ? num(analysis.payloadMassKg, 0) : '-'}
            unit="kg"
            icon={Rocket}
            hint={
              analysis.payloadFraction
                ? `${percent(analysis.payloadFraction, 2)} of lift-off mass`
                : 'Nothing to carry yet'
            }
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5 border-l border-line/70 pl-3">
          <Button size="xs" variant="ghost" onClick={() => (dirty ? setConfirmNew(true) : startFresh())}>
            New
          </Button>
          <Button
            size="xs"
            variant="primary"
            icon={Save}
            loading={save.pending}
            disabled={stack.length === 0}
            onClick={() => save.run()}
          >
            {editingId ? 'Save' : 'Save design'}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            icon={showAnalysis ? PanelRightClose : PanelRightOpen}
            onClick={() => setShowAnalysis((v) => !v)}
            aria-label={showAnalysis ? 'Hide the analysis' : 'Show the analysis'}
          />
        </div>
      </header>

      {/* ================= the workspace ================= */}
      <div className="relative flex min-h-0 flex-1">
        {/* ---- library ---------------------------------------------- */}
        <aside
          className={cn(
            'absolute inset-y-0 left-0 z-20 w-[19rem] shrink-0 flex-col border-r border-line',
            'bg-surface lg:static lg:z-auto lg:bg-surface/30',
            showLibrary ? 'flex' : 'hidden',
          )}
        >
          <div className="shrink-0 space-y-2.5 border-b border-line/70 p-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Search every part" />
            {!query && (
              <SideList
                items={Object.values(kinds).map((k) => ({
                  value: k.key,
                  label: k.label,
                  icon: KIND_ICON[k.key],
                  count: (library.data?.components ?? []).filter((c) => c.kind === k.key).length,
                }))}
                value={kindFilter}
                onChange={setKindFilter}
              />
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {!query && kinds[kindFilter] && (
              <p className="pb-1 text-2xs leading-relaxed text-ink-faint">
                {kinds[kindFilter].hint}
              </p>
            )}
            {visibleComponents.map((component) => (
              <PaletteCard
                key={component.id}
                component={component}
                onAdd={append}
                onDragStart={setDragging}
                onDragEnd={() => setDragging(null)}
                dragging={dragging?.id === component.id}
              />
            ))}
            {visibleComponents.length === 0 && (
              <p className="py-4 text-center text-2xs text-ink-faint">No part matches that.</p>
            )}
          </div>

          <p className="shrink-0 border-t border-line/70 p-3 text-2xs leading-relaxed text-ink-faint">
            Drag a part onto the pad, or double-click it to add it on top. The drawings are
            schematics at each part's real diameter and length, not photographs.
          </p>
        </aside>

        {/* ---- the pad ------------------------------------------------ */}
        <div data-pad-frame className="relative min-w-0 flex-1 bg-void">
          <RocketScale
            layout={layout}
            cog={cog}
            cop={cop}
            padAccelG={padAccelG}
            flyable={analysis.flyable}
            selectedSlotId={selectedSlot}
            onSelect={setSelectedSlot}
            onInsert={insert}
            onMoveSlot={moveSlot}
            dragKind={dragging?.kind ?? null}
            expanded={expanded}
            onToggleExpand={toggleExpand}
          />

          {/* The selected part floats over the pad rather than pushing it
              around, so the view never jumps while you are working. */}
          {selected && (
            <div className="absolute bottom-3 left-3 w-[19rem] max-w-[calc(100%-1.5rem)] rounded-card border border-line-strong bg-void/95">
              <div className="flex items-start gap-2 border-b border-line/70 p-2.5">
                <div className="shrink-0 rounded border border-line/70 bg-base/60 p-0.5">
                  <PartGlyph component={selected} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink">{selected.name}</p>
                  <p className="truncate text-2xs text-ink-faint">
                    {kinds[selected.kind]?.singular ?? selected.kind} · {selected.maker}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={ArrowUp}
                    onClick={() => nudge(selected.slotId, 1)}
                    aria-label="Move up the stack"
                  />
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={ArrowDown}
                    onClick={() => nudge(selected.slotId, -1)}
                    aria-label="Move down the stack"
                  />
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={X}
                    onClick={() => remove(selected.slotId)}
                    aria-label="Remove from the stack"
                  />
                </div>
              </div>

              <div className="max-h-[40vh] space-y-2.5 overflow-y-auto p-2.5">
                {(selected.kind === 'engine' || selected.kind === 'booster') && (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface/60 px-2.5 py-1.5">
                    <span className="text-2xs text-ink-faint">How many</span>
                    <div className="flex items-center gap-0.5">
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => setCount(selected.slotId, selected.count - 1)}
                        disabled={selected.count <= 1}
                        aria-label="One fewer"
                      >
                        &minus;
                      </Button>
                      <span className="tnum w-7 text-center font-mono text-xs text-ink">
                        {selected.count}
                      </span>
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => setCount(selected.slotId, selected.count + 1)}
                        disabled={selected.count >= 40}
                        aria-label="One more"
                      >
                        +
                      </Button>
                    </div>
                  </div>
                )}

                {selected.note && (
                  <p className="text-2xs leading-relaxed text-ink-dim">{selected.note}</p>
                )}

                <KeyValue
                  columns={2}
                  dense
                  rows={[
                    selected.propellant && {
                      label: 'Propellant',
                      value: selected.propellant,
                      mono: false,
                    },
                    { label: 'Dry mass', value: mass(selected.dryMassKg * selected.count) },
                    selected.propellantMassKg > 0 && {
                      label: 'Propellant',
                      value: mass(selected.propellantMassKg * selected.count),
                    },
                    selected.thrustSlN > 0 && {
                      label: 'Thrust, SL',
                      value: thrust(selected.thrustSlN * selected.count),
                    },
                    selected.thrustVacN > 0 && {
                      label: 'Thrust, vac',
                      value: thrust(selected.thrustVacN * selected.count),
                    },
                    selected.ispSlS > 0 && { label: 'Isp, SL', value: `${selected.ispSlS} s` },
                    selected.ispVacS > 0 && { label: 'Isp, vac', value: `${selected.ispVacS} s` },
                    { label: 'Diameter', value: `${num(selected.diameterM, 2)} m` },
                    { label: 'Length', value: `${num(selected.lengthM, 2)} m` },
                  ].filter(Boolean)}
                />

                <div className="border-t border-line/60 pt-2">
                  <p className="label-caps mb-1">Where these figures come from</p>
                  <p className="text-2xs leading-relaxed text-ink-faint">{selected.source}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ---- analysis ----------------------------------------------- */}
        <aside
          className={cn(
            'absolute inset-y-0 right-0 z-20 w-[21rem] shrink-0 flex-col border-l border-line',
            'bg-surface xl:static xl:z-auto xl:bg-surface/30',
            showAnalysis ? 'flex' : 'hidden',
          )}
        >
          <div className="flex shrink-0 border-b border-line">
            {[
              ['analysis', 'Analysis'],
              ['designs', 'Designs'],
              ['about', 'Method'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRightTab(key)}
                className={cn(
                  'flex-1 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors',
                  rightTab === key
                    ? 'border-primary text-primary-bright'
                    : 'border-transparent text-ink-faint hover:text-ink-dim',
                )}
              >
                {label}
                {key === 'analysis' && errors.length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 font-mono text-[9px] text-white">
                    {errors.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {rightTab === 'analysis' && (
              <>
                {findings.length > 0 && (
                  <div className="space-y-1.5">
                    {findings.map((finding, i) => (
                      <div
                        key={`${finding.level}-${i}`}
                        className={cn(
                          'flex items-start gap-2 rounded-md border px-2.5 py-2',
                          finding.level === 'error'
                            ? 'border-bad/40 bg-bad-soft/40'
                            : finding.level === 'warn'
                              ? 'border-warn/30 bg-warn-soft/30'
                              : 'border-line bg-overlay/50',
                        )}
                      >
                        {finding.level === 'info' ? (
                          <Info size={13} className="mt-0.5 shrink-0 text-ink-faint" aria-hidden />
                        ) : (
                          <AlertTriangle
                            size={13}
                            className={cn(
                              'mt-0.5 shrink-0',
                              finding.level === 'error' ? 'text-bad' : 'text-warn',
                            )}
                            aria-hidden
                          />
                        )}
                        <p className="text-2xs leading-relaxed text-ink-dim">{finding.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {cog && (
                  <Panel>
                    <PanelHeader title="Balance" icon={Gauge} />
                    <PanelBody className="space-y-2.5">
                      <KeyValue
                        dense
                        rows={[
                          {
                            label: 'Centre of gravity',
                            value: `${num(cog.yM, 2)} m`,
                            className: 'text-good',
                          },
                          cop && {
                            label: 'Centre of pressure',
                            value: `${num(cop.yM, 2)} m`,
                            className: 'text-warn',
                          },
                          stability && {
                            label: 'Static margin',
                            value: `${num(stability.calibers, 2)} cal`,
                            className: stability.stable ? 'text-good' : 'text-bad',
                          },
                          {
                            label: 'Pad acceleration',
                            value: padAccelG === null ? '-' : `${num(padAccelG, 2)} g`,
                          },
                        ].filter(Boolean)}
                      />
                      {stability && (
                        <div
                          className={cn(
                            'rounded-md border px-2.5 py-2',
                            stability.stable
                              ? 'border-good/30 bg-good-soft/30'
                              : 'border-warn/30 bg-warn-soft/25',
                          )}
                        >
                          <p className="text-2xs font-medium text-ink">{stability.label}</p>
                          <p className="mt-0.5 text-2xs leading-relaxed text-ink-faint">
                            {stability.note}
                          </p>
                        </div>
                      )}
                      {!cop && layout.items.length > 0 && (
                        <InlineNote>
                          The centre of pressure could not be placed on this shape. Barrowman's
                          method needs a nose and a body.
                        </InlineNote>
                      )}
                    </PanelBody>
                  </Panel>
                )}

                <Panel>
                  <PanelHeader title="Per stage" icon={Layers} />
                  <PanelBody className="space-y-3">
                    {analysis.stages.length === 0 && (
                      <p className="py-3 text-center text-2xs text-ink-faint">
                        No propulsive stage yet.
                      </p>
                    )}
                    {analysis.stages.map((stage) => (
                      <div
                        key={stage.index}
                        className="rounded-md border border-line bg-surface-2/50 p-2.5"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-medium text-ink">Stage {stage.number}</span>
                          <span className="tnum font-mono text-xs text-primary-bright">
                            {kms(stage.deltaVMs)}
                          </span>
                        </div>
                        <KeyValue
                          dense
                          className="mt-2"
                          rows={[
                            {
                              label: 'Specific impulse',
                              value: `${num(stage.ispS, 0)} s ${stage.atmospheric ? '(SL)' : '(vac)'}`,
                            },
                            { label: 'Thrust', value: thrust(stage.thrustN) },
                            {
                              label: 'Thrust-to-weight',
                              value: num(stage.twrAtIgnition, 2),
                              className:
                                stage.index === 0 && stage.twrAtIgnition < 1
                                  ? 'text-bad'
                                  : undefined,
                            },
                            {
                              label: 'Burn time',
                              value: stage.burnTimeS ? duration(stage.burnTimeS) : '-',
                            },
                            { label: 'Propellant', value: mass(stage.propellantMassKg) },
                            { label: 'Mass ratio', value: num(stage.massRatio, 2) },
                          ]}
                        />
                        <Meter
                          className="mt-2"
                          value={1 - stage.structuralFraction}
                          tone={stage.structuralFraction > 0.35 ? 'warn' : 'primary'}
                          label="Propellant by mass"
                          right={percent(1 - stage.structuralFraction, 1)}
                        />
                      </div>
                    ))}
                  </PanelBody>
                </Panel>

                <Panel>
                  <PanelHeader title="What it reaches" icon={Gauge} />
                  <PanelBody className="space-y-1">
                    {analysis.targets.map((target) => (
                      <div
                        key={target.key}
                        className="flex items-center gap-2 border-b border-line/50 py-1.5 last:border-0"
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            target.reached ? TONES.good.dot : 'bg-line-strong',
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'truncate text-xs',
                              target.reached ? 'text-ink' : 'text-ink-faint',
                            )}
                          >
                            {target.label}
                          </p>
                          <p className="truncate text-2xs text-ink-faint">{target.detail}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="tnum font-mono text-2xs text-ink-dim">
                            {kms(target.deltaV)}
                          </p>
                          <p
                            className={cn(
                              'tnum font-mono text-2xs',
                              target.reached ? 'text-good' : 'text-ink-faint',
                            )}
                          >
                            {target.marginMs >= 0 ? '+' : ''}
                            {num(target.marginMs / 1000, 2)}
                          </p>
                        </div>
                      </div>
                    ))}
                    <InlineNote className="pt-1.5">
                      Budgets include the gravity, drag and steering losses of a typical ascent,
                      which is why low Earth orbit asks 9.4 km/s rather than the 7.8 km/s of
                      orbital velocity.
                    </InlineNote>
                  </PanelBody>
                </Panel>
              </>
            )}

            {rightTab === 'designs' && (
              <>
                <Panel>
                  <PanelHeader title="Saved designs" icon={Layers} />
                  <PanelBody className="space-y-1.5">
                    {(designs.data ?? []).map((design) => (
                      <div
                        key={design.id}
                        className={cn(
                          'group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
                          design.id === editingId ? 'bg-primary-soft/40' : 'hover:bg-overlay/60',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => navigate(`/app/engineering/vehicles/${design.id}`)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span
                            className={cn(
                              'block truncate text-xs',
                              design.id === editingId ? 'text-primary-bright' : 'text-ink-dim',
                            )}
                          >
                            {design.name}
                          </span>
                          <span className="tnum block font-mono text-2xs text-ink-faint">
                            {kms(design.totalDeltaVMs)} · {design.stageCount} stage
                            {design.stageCount === 1 ? '' : 's'}
                          </span>
                        </button>
                        {design.hasErrors && (
                          <Tooltip label="This design has errors">
                            <AlertTriangle size={12} className="shrink-0 text-bad" aria-hidden />
                          </Tooltip>
                        )}
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={Trash2}
                          className="shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                          onClick={() => setRemoving(design.id)}
                          aria-label={`Delete ${design.name}`}
                        />
                      </div>
                    ))}
                    {(designs.data ?? []).length === 0 && (
                      <p className="py-3 text-center text-2xs text-ink-faint">Nothing saved yet.</p>
                    )}
                  </PanelBody>
                </Panel>

                <Panel>
                  <PanelHeader title="This design" icon={Save} />
                  <PanelBody className="space-y-3">
                    <Field label="Name" htmlFor="designName">
                      <Input
                        id="designName"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setDirty(true);
                        }}
                        placeholder="Two-stage kerolox, medium lift"
                      />
                    </Field>
                    <Field
                      label="Notes"
                      htmlFor="designNotes"
                      hint="What the design is for, and what you concluded."
                    >
                      <Textarea
                        id="designNotes"
                        rows={4}
                        value={notes}
                        onChange={(e) => {
                          setNotes(e.target.value);
                          setDirty(true);
                        }}
                        placeholder="Why this arrangement, and what the numbers showed."
                      />
                    </Field>
                    <p className="text-2xs text-ink-faint">
                      {dirty ? 'Unsaved changes.' : editingId ? 'Saved.' : 'Not saved yet.'}
                    </p>
                  </PanelBody>
                </Panel>
              </>
            )}

            {rightTab === 'about' && (
              <Panel>
                <PanelHeader title="How this is computed" icon={Info} />
                <PanelBody className="space-y-2.5">
                  <p className="text-2xs leading-relaxed text-ink-faint">{analysis.method}</p>
                  <p className="text-2xs leading-relaxed text-ink-faint">
                    The centre of gravity is the mass-weighted centroid of the stack. The centre of
                    pressure uses Barrowman's equations with the body-lift correction, which
                    assumes a small angle of attack and subsonic flow and does not model the
                    transonic shift.
                  </p>
                  <p className="text-2xs leading-relaxed text-ink-faint">
                    Standard gravity is taken as {num(G0, 5)} m/s². Component figures are published
                    specifications, named on each part. The vehicle is drawn at each part's real
                    diameter and length, so the picture and the numbers cannot disagree.
                  </p>
                  <InlineNote>
                    The pad structure, the exhaust and the starfield are scenery. Nothing in them
                    is computed, and nothing computed is hidden by them.
                  </InlineNote>
                </PanelBody>
              </Panel>
            )}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmNew}
        onClose={() => setConfirmNew(false)}
        onConfirm={startFresh}
        title="Start a new design?"
        body="The current design has unsaved changes. Starting a new one discards them."
        confirmLabel="Discard and start fresh"
        tone="danger"
      />

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => destroy.run(removing)}
        title="Delete this design?"
        body="The saved design is removed. The components in it are unaffected."
        confirmLabel="Delete design"
        tone="danger"
        loading={destroy.pending}
      />
    </div>
  );
}

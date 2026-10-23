/**
 * Launch vehicle staging analysis.
 *
 * A design is an ordered stack of components, bottom first. This module turns
 * that stack into stages, applies the ideal rocket equation to each one, and
 * reports the total velocity change against a budget of mission targets.
 *
 * What it is: the Tsiolkovsky equation, thrust-weighted specific impulse, and
 * mass flow from thrust and specific impulse. Each of those is exact.
 *
 * What it is NOT: a trajectory. Gravity, drag and steering losses are not
 * integrated. They are carried instead inside the DELTA_V_TARGETS budget
 * below, which is how launch vehicles are sized on paper: the 9.4 km/s quoted
 * for low Earth orbit is the 7.8 km/s orbital velocity plus roughly 1.6 km/s
 * of losses. A design that clears a target here is plausible, not proven. The
 * interface says so wherever it prints one of these numbers.
 */

/** Standard gravity, m/s^2. The constant in the specific-impulse definition. */
export const G0 = 9.80665;

/**
 * Velocity change needed for each mission target, in m/s, inclusive of the
 * gravity, drag and steering losses of a typical ascent from an equatorial or
 * mid-latitude site. Ordered from easiest to hardest.
 */
export const DELTA_V_TARGETS = [
  {
    key: 'leo',
    label: 'Low Earth orbit',
    detail: '200 km circular, due east',
    deltaV: 9400,
  },
  {
    key: 'sso',
    label: 'Sun-synchronous orbit',
    detail: '700 km, retrograde inclination, no rotation benefit',
    deltaV: 9900,
  },
  {
    key: 'gto',
    label: 'Geostationary transfer orbit',
    detail: '200 x 35,786 km',
    deltaV: 11800,
  },
  {
    key: 'tli',
    label: 'Trans-lunar injection',
    detail: 'Departure towards the Moon',
    deltaV: 12400,
  },
  {
    key: 'escape',
    label: 'Earth escape',
    detail: 'C3 = 0, interplanetary departure',
    deltaV: 12700,
  },
];

/** Component kinds that carry the vehicle, as opposed to riding on it. */
const PROPULSIVE_KINDS = new Set(['engine', 'tank', 'booster']);
/** Component kinds that count as mass every stage has to lift. */
const PAYLOAD_KINDS = new Set(['payload', 'adapter', 'fairing']);

/**
 * Thrust-weighted specific impulse of a set of engines.
 *
 * Mass flows add, so the combination is the harmonic mean weighted by thrust:
 * total thrust divided by total mass flow. Averaging the specific impulses
 * directly would be wrong whenever the engines differ.
 *
 * @param {Array<{thrustN: number, ispS: number}>} engines
 * @returns {number} Effective specific impulse in seconds, or 0.
 */
export function effectiveIsp(engines) {
  let thrust = 0;
  let massFlow = 0;
  for (const e of engines) {
    if (!e.thrustN || !e.ispS) continue;
    thrust += e.thrustN;
    massFlow += e.thrustN / (e.ispS * G0);
  }
  if (massFlow <= 0) return 0;
  return thrust / (massFlow * G0);
}

/**
 * Split a stack into stages.
 *
 * An interstage is a separation plane, so it ends the stage below it. That
 * matches how the hardware is actually built, and it means the stack itself
 * carries the staging rather than the user having to number anything.
 *
 * The interstage stays with the lower stage after separation, which is the
 * usual arrangement, so its mass counts against the stage below.
 *
 * @param {Array<object>} parts Placed components, bottom first.
 * @returns {{stages: Array<object>, payloadParts: Array<object>}}
 */
export function splitStages(parts) {
  const stages = [];
  let current = [];

  for (const part of parts) {
    if (PAYLOAD_KINDS.has(part.kind)) continue;
    current.push(part);
    if (part.kind === 'interstage') {
      stages.push(current);
      current = [];
    }
  }
  if (current.length) stages.push(current);

  return {
    stages: stages.filter((group) => group.some((p) => PROPULSIVE_KINDS.has(p.kind))),
    payloadParts: parts.filter((p) => PAYLOAD_KINDS.has(p.kind)),
  };
}

/**
 * Analyse a stack of components.
 *
 * @param {Array<object>} parts Placed components, bottom first. Each carries
 *   kind, dryMassKg, propellantMassKg, thrustSlN, thrustVacN, ispSlS,
 *   ispVacS and diameterM.
 * @returns {object} Per-stage figures, the totals, the reachable targets and
 *   every validation finding.
 */
export function analyseVehicle(placed = []) {
  /*
   * A placed component may stand for several identical units: nine engines on
   * one thrust structure, two strap-on boosters. Scaling mass and thrust by
   * the count leaves specific impulse alone, which is right, because mass flow
   * scales with thrust.
   */
  const parts = placed.map((p) => {
    const n = Math.max(1, Math.round(p.count ?? 1));
    if (n === 1) return p;
    return {
      ...p,
      dryMassKg: (p.dryMassKg ?? 0) * n,
      propellantMassKg: (p.propellantMassKg ?? 0) * n,
      thrustSlN: (p.thrustSlN ?? 0) * n,
      thrustVacN: (p.thrustVacN ?? 0) * n,
    };
  });

  const { stages: stageGroups, payloadParts } = splitStages(parts);

  const payloadMassKg = payloadParts.reduce((n, p) => n + (p.dryMassKg ?? 0), 0);
  const findings = [];

  /*
   * Work from the top down to get the mass each stage has to push, then
   * reverse: a stage lifts everything above it, including the propellant still
   * in the stages it has not yet separated from.
   */
  const stageWet = stageGroups.map((group) =>
    group.reduce((n, p) => n + (p.dryMassKg ?? 0) + (p.propellantMassKg ?? 0), 0),
  );

  const stages = stageGroups.map((group, index) => {
    const atmospheric = index === 0;
    const engines = group.filter((p) => p.kind === 'engine' || p.kind === 'booster');
    const dryMassKg = group.reduce((n, p) => n + (p.dryMassKg ?? 0), 0);
    const propellantMassKg = group.reduce((n, p) => n + (p.propellantMassKg ?? 0), 0);

    // The first stage flies through the atmosphere, so it is rated at sea
    // level; everything above it is rated in vacuum.
    const running = engines.map((e) => ({
      thrustN: atmospheric ? (e.thrustSlN ?? 0) : (e.thrustVacN ?? e.thrustSlN ?? 0),
      ispS: atmospheric ? (e.ispSlS ?? 0) : (e.ispVacS ?? e.ispSlS ?? 0),
    }));

    const thrustN = running.reduce((n, e) => n + e.thrustN, 0);
    const ispS = effectiveIsp(running);

    const massAboveKg =
      payloadMassKg + stageWet.slice(index + 1).reduce((n, m) => n + m, 0);

    const igniteMassKg = dryMassKg + propellantMassKg + massAboveKg;
    const burnoutMassKg = dryMassKg + massAboveKg;

    const massRatio = burnoutMassKg > 0 ? igniteMassKg / burnoutMassKg : 1;
    const deltaVMs = ispS > 0 && massRatio > 1 ? ispS * G0 * Math.log(massRatio) : 0;

    // Mass flow follows from thrust and specific impulse, so burn time is the
    // propellant load divided by it.
    const massFlowKgS = ispS > 0 ? thrustN / (ispS * G0) : 0;
    const burnTimeS = massFlowKgS > 0 ? propellantMassKg / massFlowKgS : null;

    const twrAtIgnition = igniteMassKg > 0 ? thrustN / (igniteMassKg * G0) : 0;

    return {
      index,
      number: index + 1,
      parts: group,
      engineCount: engines.reduce((n, e) => n + (e.count ?? 1), 0),
      atmospheric,
      dryMassKg,
      propellantMassKg,
      massAboveKg,
      igniteMassKg,
      burnoutMassKg,
      massRatio,
      thrustN,
      ispS,
      deltaVMs,
      burnTimeS,
      massFlowKgS,
      twrAtIgnition,
      // How much of the stage is structure rather than propellant. Below about
      // 0.2 is good for a kerolox stage; a hydrogen stage runs higher.
      structuralFraction:
        dryMassKg + propellantMassKg > 0 ? dryMassKg / (dryMassKg + propellantMassKg) : 1,
    };
  });

  const totalDeltaVMs = stages.reduce((n, s) => n + s.deltaVMs, 0);
  const grossMassKg = stages.reduce((n, s) => n + s.dryMassKg + s.propellantMassKg, 0) + payloadMassKg;
  const propellantMassKg = stages.reduce((n, s) => n + s.propellantMassKg, 0);

  /* ---- validation ---------------------------------------------------- */

  if (parts.length === 0) {
    findings.push({
      level: 'info',
      message: 'Nothing on the pad yet. Drag a component across to start.',
    });
  }

  if (stages.length === 0 && parts.length > 0) {
    findings.push({
      level: 'error',
      message: 'No propulsive stage. A stage needs at least one engine and a tank.',
    });
  }

  stages.forEach((stage) => {
    const hasEngine = stage.parts.some((p) => p.kind === 'engine' || p.kind === 'booster');
    const hasPropellant = stage.propellantMassKg > 0;
    if (!hasEngine) {
      findings.push({
        level: 'error',
        stage: stage.number,
        message: `Stage ${stage.number} carries propellant but has no engine.`,
      });
    }
    if (hasEngine && !hasPropellant) {
      findings.push({
        level: 'error',
        stage: stage.number,
        message: `Stage ${stage.number} has an engine but no propellant to feed it.`,
      });
    }
    if (hasEngine && hasPropellant && stage.ispS === 0) {
      findings.push({
        level: 'error',
        stage: stage.number,
        message:
          `Stage ${stage.number} produces no thrust at this altitude. A vacuum engine ` +
          'cannot be used as a first stage.',
      });
    }
  });

  const first = stages[0];
  if (first && first.thrustN > 0) {
    if (first.twrAtIgnition < 1) {
      findings.push({
        level: 'error',
        stage: 1,
        message:
          `Thrust-to-weight at lift-off is ${first.twrAtIgnition.toFixed(2)}. ` +
          'Below 1.0 the vehicle cannot leave the pad.',
      });
    } else if (first.twrAtIgnition < 1.2) {
      findings.push({
        level: 'warn',
        stage: 1,
        message:
          `Thrust-to-weight at lift-off is only ${first.twrAtIgnition.toFixed(2)}. ` +
          'Gravity losses climb steeply below about 1.2, so the real ascent will ' +
          'need more velocity change than the budget here assumes.',
      });
    } else if (first.twrAtIgnition > 2.2) {
      findings.push({
        level: 'warn',
        stage: 1,
        message:
          `Thrust-to-weight at lift-off is ${first.twrAtIgnition.toFixed(2)}, which is high. ` +
          'Expect to throttle back through maximum dynamic pressure.',
      });
    }
  }

  /*
   * Strap-ons are mounted around the core, so an odd number puts the thrust
   * line off the centreline. Real vehicles fly two, four or six.
   */
  for (const part of parts) {
    if (part.kind === 'booster' && part.count % 2 === 1 && part.count > 0) {
      findings.push({
        level: 'warn',
        message:
          `${part.count === 1 ? 'A single' : `An odd number (${part.count}) of`} ${part.name} ` +
          'sits off the centreline. Strap-on boosters are flown in symmetric pairs, ' +
          'because an unbalanced one puts a steady moment on the vehicle that the ' +
          'gimbal has to trim out for the whole burn.',
      });
    }
  }

  if (payloadParts.length === 0 && stages.length > 0) {
    findings.push({
      level: 'warn',
      message:
        'No payload on the stack, so the figures below are for an empty vehicle. ' +
        'Add a payload to size the design.',
    });
  }

  // A fairing protects the payload, so nothing propulsive belongs above it.
  const fairingIndex = parts.findIndex((p) => p.kind === 'fairing');
  if (fairingIndex >= 0) {
    const propulsiveAbove = parts
      .slice(fairingIndex + 1)
      .some((p) => PROPULSIVE_KINDS.has(p.kind) || p.kind === 'interstage');
    if (propulsiveAbove) {
      findings.push({
        level: 'warn',
        message: 'The fairing has vehicle hardware above it. A fairing goes at the top of the stack.',
      });
    }
  }

  /*
   * Adjacent diameters that disagree need a taper or an adapter in between.
   *
   * Only the load-bearing body is checked. An engine bell is narrower than the
   * tank it hangs under, a fairing is wider than the stage it sits on, and a
   * payload lives inside the fairing rather than butting against it: none of
   * those is a mismatch, and warning about them would bury the one case that
   * matters, which is a stage mated to a structure of a different width.
   */
  const bodyParts = parts.filter((p) => p.kind === 'tank' || p.kind === 'interstage');
  for (let i = 0; i < bodyParts.length - 1; i += 1) {
    const a = bodyParts[i];
    const b = bodyParts[i + 1];
    if (!a.diameterM || !b.diameterM) continue;
    const gap = Math.abs(a.diameterM - b.diameterM);
    if (gap > 0.6) {
      findings.push({
        level: 'warn',
        message:
          `${a.name} is ${a.diameterM.toFixed(2)} m across and ${b.name} is ` +
          `${b.diameterM.toFixed(2)} m. A difference that large needs an adapter between them.`,
      });
    }
  }

  stages.forEach((stage) => {
    /*
     * A kick stage is structure-heavy by nature: the tank cannot shrink below
     * the plumbing inside it. Only stages large enough for the ratio to be a
     * design choice are worth remarking on.
     */
    if (stage.propellantMassKg > 500 && stage.structuralFraction > 0.35) {
      findings.push({
        level: 'warn',
        stage: stage.number,
        message:
          `Stage ${stage.number} is ${(stage.structuralFraction * 100).toFixed(0)}% structure by mass. ` +
          'Above about a third, the stage is carrying more tank than propellant.',
      });
    }
  });

  /* ---- what it reaches ------------------------------------------------ */

  const blocking = findings.some((f) => f.level === 'error');
  const targets = DELTA_V_TARGETS.map((target) => ({
    ...target,
    reached: !blocking && totalDeltaVMs >= target.deltaV,
    marginMs: totalDeltaVMs - target.deltaV,
  }));
  const best = blocking ? null : [...targets].reverse().find((t) => t.reached) ?? null;
  const nextUp = targets.find((t) => !t.reached) ?? null;

  return {
    stages,
    payloadParts,
    payloadMassKg,
    grossMassKg,
    propellantMassKg,
    dryMassKg: grossMassKg - propellantMassKg - payloadMassKg,
    totalDeltaVMs,
    // Payload as a fraction of what leaves the pad. A percent or two is normal.
    payloadFraction: grossMassKg > 0 ? payloadMassKg / grossMassKg : 0,
    liftoffThrustN: first?.thrustN ?? 0,
    liftoffTwr: first?.twrAtIgnition ?? 0,
    targets,
    best,
    nextUp,
    findings,
    flyable: !blocking && stages.length > 0 && payloadParts.length > 0,
    method:
      'Velocity change is the ideal rocket equation per stage, summed. Specific ' +
      'impulse is thrust-weighted across the engines running, sea level for the ' +
      'first stage and vacuum above it. Burn time is the propellant load divided ' +
      'by mass flow. Gravity, drag and steering losses are not integrated; they ' +
      'are carried inside the mission budgets instead.',
  };
}

/** A short verdict line for a completed analysis. */
export function verdictFor(analysis) {
  if (!analysis) return null;
  if (analysis.findings.some((f) => f.level === 'error')) {
    return { tone: 'bad', label: 'Will not fly', detail: 'Resolve the errors below.' };
  }
  if (analysis.stages.length === 0) {
    return { tone: 'default', label: 'Incomplete', detail: 'No propulsive stage yet.' };
  }
  if (!analysis.best) {
    const short = analysis.nextUp ? (analysis.nextUp.deltaV - analysis.totalDeltaVMs) / 1000 : null;
    return {
      tone: 'warn',
      label: 'Reaches no orbit',
      detail: short
        ? `${short.toFixed(2)} km/s short of low Earth orbit.`
        : 'Not enough velocity change for low Earth orbit.',
    };
  }
  return {
    tone: 'good',
    label: `Reaches ${analysis.best.label.toLowerCase()}`,
    detail: `${(analysis.best.marginMs / 1000).toFixed(2)} km/s of margin in hand.`,
  };
}

/**
 * Where everything sits along the vehicle, and what that does to its balance.
 *
 * The staging analysis in vehicle.js cares only about masses and thrust. The
 * drawing needs positions, and two quantities that only exist once you have
 * positions: the centre of gravity, and the centre of pressure.
 *
 * ## The centre of pressure
 *
 * Barrowman's equations are the standard first-order method: for an
 * axisymmetric body at a small angle of attack, the normal force comes from
 * the nose and from every change in diameter, and a straight tube contributes
 * nothing.
 *
 * Applied literally to a launch vehicle that is mostly straight tube, they
 * fall apart. A wide fairing on a narrow core gives a large negative
 * contribution at the shoulder which very nearly cancels the nose, and the
 * centre of pressure runs off to infinity or lands outside the vehicle. That
 * is a known limit of the method, not a property of the rocket.
 *
 * So the body-lift correction is included, as it is in any serious
 * implementation: a long body at an angle of attack really does generate a
 * normal force, roughly proportional to its planform area, acting at its
 * centroid. With it the answer is well behaved and lands where it should.
 *
 * ## What the answer means
 *
 * It usually says the vehicle is aerodynamically UNSTABLE, with the centre of
 * pressure ahead of the centre of gravity. That is correct and worth saying
 * plainly: almost every orbital launch vehicle is, and they fly because the
 * engines gimbal, not because the shape holds itself straight.
 *
 * Limits, stated because they matter: a small angle of attack is assumed,
 * flow is treated as subsonic, and nothing here models the rearward shift of
 * the centre of pressure through the transonic region, which is where a real
 * vehicle is worked hardest.
 */

/** Kinds that sit in the stack, bottom to top, and add to the vehicle's length. */
const INLINE_KINDS = new Set(['engine', 'tank', 'interstage', 'adapter', 'payload', 'fairing']);

/** Kinds a fairing closes over: they ride inside it rather than above it. */
const ENCLOSABLE_KINDS = new Set(['payload', 'adapter']);

/** Galejs body-lift coefficient. The usual value. */
const BODY_LIFT_K = 1.1;

/** A part's total mass, including its multiplier. */
function massOf(part) {
  const n = Math.max(1, Math.round(part.count ?? 1));
  return ((part.dryMassKg ?? 0) + (part.propellantMassKg ?? 0)) * n;
}

/**
 * Place every component along the long axis.
 *
 * In-line parts stack bottom first. Two things are not simple stacking,
 * because the hardware is not:
 *
 *   - A fairing ENCLOSES the payload and any adapter directly beneath it,
 *     rather than sitting on top of them. It therefore spans the same stretch
 *     of the vehicle, and the enclosed parts are marked so the drawing can
 *     show them inside it and the aerodynamics can ignore them.
 *   - A strap-on booster does not lengthen the vehicle. It hangs alongside,
 *     its base level with the base of the stage it fires with.
 *
 * @param {Array<object>} parts Placed components, bottom first.
 */
export function layoutVehicle(parts = []) {
  const items = [];
  const boosters = [];

  let y = 0;
  let stage = 1;

  parts.forEach((part, stackIndex) => {
    const count = Math.max(1, Math.round(part.count ?? 1));
    const structural = !ENCLOSABLE_KINDS.has(part.kind) && part.kind !== 'fairing';
    const base = {
      ...part,
      count,
      stackIndex,
      massKg: massOf(part),
      stage: structural ? stage : null,
      enclosed: false,
    };

    if (part.kind === 'booster') {
      boosters.push({ ...base, yBottom: null, yTop: null, pendingStage: stage });
      return;
    }
    if (!INLINE_KINDS.has(part.kind)) return;

    const lengthM = Math.max(0.05, part.lengthM ?? 1);

    if (part.kind === 'fairing') {
      /*
       * Reach back down the stack over the contiguous run of payload and
       * adapter parts and close over them. The fairing starts at the bottom of
       * that run and is at least as long as it: a fairing shorter than its
       * payload would not be a fairing.
       */
      let first = items.length;
      while (first > 0 && ENCLOSABLE_KINDS.has(items[first - 1].kind) && !items[first - 1].enclosed) {
        first -= 1;
      }
      const enclosed = items.slice(first);
      enclosed.forEach((i) => {
        i.enclosed = true;
      });
      const yBottom = enclosed.length ? enclosed[0].yBottom : y;
      const spanM = Math.max(lengthM, y - yBottom);
      items.push({
        ...base,
        yBottom,
        yTop: yBottom + spanM,
        lengthM: spanM,
        encloses: enclosed.map((i) => i.slotId),
      });
      y = yBottom + spanM;
      return;
    }

    items.push({ ...base, yBottom: y, yTop: y + lengthM, lengthM });
    y += lengthM;

    // An interstage is the separation plane, so everything above it is the
    // next stage up.
    if (part.kind === 'interstage') stage += 1;
  });

  for (const booster of boosters) {
    const stageItems = items.filter((i) => i.stage === booster.pendingStage);
    const yBottom = stageItems.length ? Math.min(...stageItems.map((i) => i.yBottom)) : 0;
    booster.yBottom = yBottom;
    booster.yTop = yBottom + Math.max(0.05, booster.lengthM ?? 1);
    booster.stage = booster.pendingStage;
    delete booster.pendingStage;
  }

  const all = [...items, ...boosters];
  const totalLengthM = items.reduce((m, i) => Math.max(m, i.yTop), 0);

  return {
    items,
    boosters,
    all,
    totalLengthM,
    maxDiameterM: all.reduce((m, i) => Math.max(m, i.diameterM ?? 0), 0),
    grossMassKg: all.reduce((n, i) => n + i.massKg, 0),
  };
}

/**
 * Centre of gravity, as a height above the base.
 *
 * Each component is treated as uniform along its own length. That is close
 * enough for a tank and exactly wrong for nothing that matters here: the
 * answer is dominated by which tank is full.
 */
export function centreOfMass(layout) {
  const parts = layout.all.filter((p) => p.massKg > 0);
  const massKg = parts.reduce((n, p) => n + p.massKg, 0);
  if (massKg <= 0) return null;
  const moment = parts.reduce((n, p) => n + p.massKg * ((p.yBottom + p.yTop) / 2), 0);
  return { yM: moment / massKg, massKg };
}

/**
 * The outline the airflow actually sees, nose first.
 *
 * Engines are left out: Barrowman says nothing useful about a base, and the
 * bells are shielded by the thrust structure at the angles of attack this
 * assumes. Anything inside a fairing is left out because it is inside a
 * fairing.
 */
function externalProfile(layout) {
  return layout.items
    .filter((i) => i.kind !== 'engine' && !i.enclosed && (i.diameterM ?? 0) > 0)
    .sort((a, b) => b.yTop - a.yTop);
}

/**
 * Centre of pressure, by Barrowman with the body-lift correction.
 *
 * @returns {{yM: number, cnAlpha: number, contributions: Array<object>}|null}
 */
export function centreOfPressure(layout) {
  const profile = externalProfile(layout);
  if (profile.length === 0) return null;

  const dRef = layout.maxDiameterM;
  const total = layout.totalLengthM;
  if (!dRef || !total) return null;

  const areaRef = (Math.PI / 4) * dRef ** 2;
  /** Barrowman works from the nose down, so x = 0 at the tip. */
  const xFromNose = (y) => total - y;

  const contributions = [];

  // ---- the nose -----------------------------------------------------
  // A fairing is an ogive; anything else at the top is treated as a cone,
  // which puts its centre of pressure further back and is the more
  // conservative assumption.
  const nose = profile[0];
  const ogive = nose.kind === 'fairing';
  contributions.push({
    kind: 'nose',
    label: `${nose.name}`,
    cn: 2 * ((nose.diameterM ?? dRef) / dRef) ** 2,
    xM: xFromNose(nose.yTop) + (ogive ? 0.466 : 0.666) * nose.lengthM,
  });

  // ---- changes of diameter -------------------------------------------
  for (let i = 0; i < profile.length - 1; i += 1) {
    const fore = profile[i];
    const aft = profile[i + 1];
    const dFore = fore.diameterM;
    const dAft = aft.diameterM;
    if (!dFore || !dAft || Math.abs(dFore - dAft) < 0.01) continue;

    const ratio = dFore / dAft;
    const transitionLength =
      fore.kind === 'adapter' ? fore.lengthM : aft.kind === 'adapter' ? aft.lengthM : 0;

    let xM = xFromNose(fore.yBottom);
    if (transitionLength > 0 && Math.abs(1 - ratio ** 2) > 1e-6) {
      xM += (transitionLength / 3) * (1 + (1 - ratio) / (1 - ratio ** 2));
    }
    contributions.push({
      kind: 'transition',
      label: `${dFore.toFixed(2)} m to ${dAft.toFixed(2)} m`,
      cn: 2 * ((dAft / dRef) ** 2 - (dFore / dRef) ** 2),
      xM,
    });
  }

  // ---- body lift -------------------------------------------------------
  // Each section's planform area generates a normal force at its centroid. A
  // nose is roughly half the rectangle its length and base diameter would
  // give; a tube is the whole rectangle.
  for (const section of profile) {
    const planform =
      (section.diameterM ?? 0) * section.lengthM * (section === nose && ogive ? 0.55 : 1);
    if (planform <= 0) continue;
    contributions.push({
      kind: 'body',
      label: `${section.name} body`,
      cn: (BODY_LIFT_K * planform) / areaRef,
      xM: xFromNose((section.yBottom + section.yTop) / 2),
    });
  }

  const cnAlpha = contributions.reduce((n, c) => n + c.cn, 0);
  if (Math.abs(cnAlpha) < 1e-6) return null;

  const xCp = contributions.reduce((n, c) => n + c.cn * c.xM, 0) / cnAlpha;
  // A result outside the vehicle means the method has broken down rather than
  // that the rocket is strange, so it is reported as unavailable.
  if (!Number.isFinite(xCp) || xCp < 0 || xCp > total) return null;

  return { yM: total - xCp, cnAlpha, contributions };
}

/**
 * Static stability, in calibers.
 *
 * Positive means the centre of pressure is behind the centre of gravity and
 * the vehicle weathercocks into the airflow on its own. Negative means it does
 * not, and something has to hold it straight.
 */
export function stabilityOf(layout, cog, cop) {
  if (!cog || !cop || !layout.maxDiameterM) return null;
  const calibers = (cog.yM - cop.yM) / layout.maxDiameterM;
  const stable = calibers > 0;
  return {
    calibers,
    stable,
    label: stable ? 'Statically stable' : 'Aerodynamically unstable',
    note: stable
      ? 'The centre of pressure sits behind the centre of gravity, so the vehicle weathercocks into the airflow by itself.'
      : 'The centre of pressure sits ahead of the centre of gravity. Almost every orbital launch vehicle does: a long parallel body gives no restoring moment, so the nose wins. They fly because the engines gimbal, not because the shape is stable.',
  };
}

/** Everything the drawing needs, in one call. */
export function vehicleGeometry(parts = []) {
  const layout = layoutVehicle(parts);
  const cog = centreOfMass(layout);
  const cop = centreOfPressure(layout);
  return { layout, cog, cop, stability: stabilityOf(layout, cog, cop) };
}

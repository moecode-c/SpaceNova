import { useEffect, useMemo, useRef, useState } from 'react';
import {
  satrecFor, stateAt, lookAnglesFromState, groundTrack, footprintAngle, dopplerShiftHz,
} from '../engine/propagate.js';
import { sunLookAngles, skyCondition } from '../engine/sun.js';

/**
 * Browser-side propagation loop.
 *
 * SRS module 4 requires the tracker to update from the cached element set
 * rather than polling the server for positions. The element sets arrive once
 * from api/tracking; everything below is computed locally at a fixed rate.
 *
 * Ten updates a second would be wasted: a low Earth orbit object moves about
 * seven kilometres a second, so at a whole-world scale four updates a second is
 * already smooth. The interval is a prop so a hidden tab can slow it down.
 */
export function useTracking(elementSets, observer, { intervalMs = 250, minElevationDeg = 10, trackMinutes = 95 } = {}) {
  const [tick, setTick] = useState(() => Date.now());
  const frame = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      setTick(Date.now());
      frame.current = setTimeout(loop, intervalMs);
    };
    frame.current = setTimeout(loop, intervalMs);
    return () => {
      cancelled = true;
      if (frame.current) clearTimeout(frame.current);
    };
  }, [intervalMs]);

  const satrecs = useMemo(() => {
    const map = new Map();
    for (const row of elementSets ?? []) {
      const satrec = satrecFor(row.elementSet.line1, row.elementSet.line2);
      if (satrec) map.set(row.objectId, satrec);
    }
    return map;
  }, [elementSets]);

  const states = useMemo(() => {
    const date = new Date(tick);
    const out = [];
    for (const row of elementSets ?? []) {
      const satrec = satrecs.get(row.objectId);
      if (!satrec) {
        out.push({ ...row, error: 'Element set could not be parsed.' });
        continue;
      }
      const state = stateAt(satrec, date);
      if (!state) {
        out.push({ ...row, error: 'Propagation failed for this epoch.' });
        continue;
      }
      const look = observer ? lookAnglesFromState(state, date, observer) : null;
      out.push({
        ...row,
        latitude: state.latitude,
        longitude: state.longitude,
        altitudeKm: state.altitudeKm,
        speedKms: state.speedKms,
        footprintRadiusKm: state.footprintRadiusKm,
        footprintAngleDeg: footprintAngle(state.altitudeKm, minElevationDeg),
        eclipse: state.eclipse,
        eclipsed: !state.eclipse.illuminated,
        azimuth: look?.azimuth ?? null,
        elevation: look?.elevation ?? null,
        rangeKm: look?.rangeKm ?? null,
        rangeRateKms: look?.rangeRateKms ?? null,
        dopplerHz:
          look && row.downlinkHz ? dopplerShiftHz(row.downlinkHz, look.rangeRateKms) : null,
        aboveHorizon: look ? look.elevation >= minElevationDeg : false,
        at: date,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, elementSets, satrecs, observer?.latitude, observer?.longitude, observer?.altitudeM, minElevationDeg]);

  // Ground tracks are far more expensive than a position, so they are only
  // recomputed every few minutes rather than on every tick.
  const trackEpoch = Math.floor(tick / 120000);
  const tracks = useMemo(() => {
    const date = new Date(tick);
    const out = [];
    for (const row of elementSets ?? []) {
      const satrec = satrecs.get(row.objectId);
      if (!satrec) continue;
      out.push({
        id: row.objectId,
        name: row.name,
        segments: groundTrack(satrec, date, {
          beforeMinutes: Math.round(trackMinutes * 0.35),
          afterMinutes: Math.round(trackMinutes * 0.65),
          stepSeconds: 45,
        }),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackEpoch, elementSets, satrecs, trackMinutes]);

  const sky = useMemo(() => {
    if (!observer) return null;
    const date = new Date(tick);
    const satrec = satrecs.values().next().value;
    // gmst is the same for every object; borrow it from any propagated state.
    const state = satrec ? stateAt(satrec, date) : null;
    if (!state) return null;
    const sun = sunLookAngles(date, observer, state.gmst);
    return { ...sun, condition: skyCondition(sun.elevation) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(tick / 30000), observer?.latitude, observer?.longitude, satrecs]);

  return { states, tracks, sky, at: new Date(tick) };
}

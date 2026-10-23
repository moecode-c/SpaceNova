# SpaceNova

Satellite tracking, observation planning, launch records, private research
workspaces and launch vehicle design, in one React application.

This repository is the **front end**. There is no back end yet. Every screen
reads its data through `src/api/*`, which currently serves in-memory fixtures;
swapping a module there for `fetch` calls against an Express API is the whole of
the Phase 2 integration, and no screen changes.

The orbital figures are **not** fixtures. Positions, ground tracks, footprints,
look angles, pass windows, visibility decisions, magnitude estimates and decay
windows are computed in the browser by the engine in `src/engine`, from the
element sets the API hands over.

---

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build
```

No environment variables, no services, no database. It runs offline: the world
geometry is bundled rather than fetched from a tile server.

### Signing in

There is no authentication server, so the sign-in screen accepts any password of
eight characters for a seeded address, and carries four buttons that enter
directly as each role:

| Role | Screens | What it adds |
| --- | :-: | --- |
| Observer | 8 | Live tracking, observation planning, observer locations, observation log |
| Researcher | 9 | Private workspaces, immutable datasets by upload or by freezing a query, collaborators, citable exports |
| Engineer | 12 | Element-set diagnostics, decay estimates, ground stations, the vehicle builder |
| Administrator | 13 | Accounts and roles, catalogue, data sources, thresholds, audit log |

Every account has exactly one role, set by an administrator on the account.
There is no request flow: nobody can ask to be upgraded. An administrator runs
the platform and does not get another role's private work, which is why the
researcher and engineer sections do not appear for them.

The account menu in the top right switches role at any time.

---

## Layout

```
src/
  engine/        Pure orbital functions. No React, no network, no fixtures.
    sun.js         Solar and lunar position, twilight, conical Earth shadow
    tle.js         Element-set construction, checksums, orbit geometry
    propagate.js   SGP4 wrapper, geodetic state, ground track, look angles
    passes.js      Coarse horizon scan, bisection refinement, pass records
    visibility.js  The four visibility clauses, evaluated separately
    score.js       Pass quality score and scheduling conflict resolution
    magnitude.js   Estimated visual magnitude, with its uncertainty stated
    freshness.js   Element-set freshness bands and the propagation horizon
    decay.js       Orbital decay and re-entry window estimate
    vehicle.js     Staged velocity change, thrust-to-weight, burn time
    vehicle-geometry.js  Layout, centre of gravity, centre of pressure
    defaults.js    Every threshold, as data rather than as constants

  api/           The seam. One module per back-end area.
  mock/          Seeded fixtures. Deterministic, so reloads look the same.
  components/    ui/ primitives, data/ domain display, map/ canvas and SVG, layout/
  context/       Auth and viewer settings
  hooks/         Data fetching and the browser propagation loop
  lib/           Formatting, seeded random, CSV and JSON parsing and download
  pages/         public/ auth/ app/ research/ engineering/ admin/
```

### Replacing the fixtures with a back end

`src/api/index.js` lists the route each namespace maps to. Every call returns the
same envelope:

```js
{ data, meta: { source, sourceLabel, kind, retrievedAt, cached, degraded, thresholds } }
```

`meta` is not decoration. The `SourceTag`, `DegradedBanner` and `FixtureNotice`
components read it, which is how every panel on screen carries its source and
age, and how a cached value past its time to live gets a visible staleness
banner instead of passing silently as current.

---

## Decisions worth knowing

**Positions are computed in the browser.** The tracker asks the server for
element sets, not for coordinates, then propagates locally several times a
second. The server is touched again only when a cache entry expires.

**A pass that clears the horizon is not the same as a visible pass.** Four
clauses are evaluated separately: maximum elevation against the site threshold,
the satellite outside the conical Earth shadow, the observer's sky below the
twilight threshold, and the pass clear of the measured horizon obstruction mask.
When a pass is rejected the interface names the clause that failed.

**Rankings are explainable.** The quality score has five normalised terms with
published weights, and the terms are shown on screen rather than hidden in a
tooltip. When the cloud forecast is missing, that term is dropped, the remaining
weights are renormalised, and the window is marked as not directly comparable.

**Stale data is refused, not extrapolated.** Element sets are banded fresh,
usable, stale or expired. Past the propagation horizon the engine refuses to
predict and reports the refusal with the object named.

**Nothing estimated is presented as measured.** Computed values are labelled
computed. Magnitudes are labelled estimates with a stated uncertainty. The
staging analysis prints the method it used and the losses it does not model.
Every panel carries values derived from propagation, read from a public feed, or
supplied by the user: there is no fourth category, and no fabricated reading
anywhere.

**One screen per job.** Where two screens showed the same data from slightly
different angles, the weaker one was deleted rather than folded in. The look-up
view duplicated the tracker's look angles; watchlists existed only to feed plans,
so a plan now names its objects directly; the preferences and export screens each
held a handful of controls that belong next to the thing they affect.

**Thresholds are data.** Minimum elevation, twilight threshold, propagation
horizon, scan step, refinement tolerance, score weights, turnaround gap and
retention periods are all editable from the administration screens and take
effect on the next computation. Dataset snapshots record the thresholds in force
when they were frozen, so a change later does not rewrite an old result.

---

## The vehicle builder

An engineer assembles a launch vehicle from a library of real components and
reads back what it can reach. It is a **workspace, not a page**: it takes the
whole window, the panels either side collapse, and the pad in the middle is a
camera over the scene. Scroll to zoom at the pointer, drag to pan, and the
height scale re-rules itself as you go, from 10 m ticks on the whole vehicle
down to 1 m when you are in among the engines.

**The vehicle is drawn to scale, and the drawing is what you build on**: drag a
part from the library onto the pad and it appears where you dropped it, click a
section to select it, drag a section to move it.
Bottom stage at the bottom; an interstage is a separation plane, so the stack
itself expresses the staging. Engines carry a count, so nine Merlins are one
entry, drawn as nine bells clamped to the width of the stage they bolt to.
Everything also works from the keyboard.

Every part is drawn at its real diameter and length, so the picture and the
numbers cannot disagree. The drawings are schematics rather than photographs,
which is deliberate: a photograph would be somebody's copyrighted image, it
would not scale with the component's dimensions, and it would not show you the
geometry the analysis is actually using.

The numbers come from `src/engine/vehicle.js`: the ideal rocket equation per
stage, thrust-weighted specific impulse across the engines running, sea level
for the first stage and vacuum above it, and burn time from mass flow. Gravity,
drag and steering losses are not integrated; they sit inside the mission Δv
budgets, which is how a vehicle is sized on paper. The screen says so.

The pad itself — the deck, the flame trench, the service tower and its
umbilical arm, the starfield — is scenery, and the Method tab says so. None of
it is computed and none of it hides anything that is.

Alongside the staging figures it marks the **centre of gravity** and the
**centre of pressure** on the drawing. The second uses Barrowman's equations
with the body-lift correction, without which a wide fairing on a narrow core
puts the answer outside the vehicle. It usually reports the design as
aerodynamically unstable, and says so plainly, because almost every orbital
launch vehicle is: a long parallel body gives no restoring moment, so the nose
wins, and they fly on engine gimbal rather than on static stability.

Component figures in `src/mock/vehicles.js` are published specifications, each
naming its source, which makes the analysis checkable. The seeded Falcon 9
arrangement returns 70.1 m of height against a real 70 m, 553.9 t gross
lift-off mass against a real ~549 t, 7,605 kN of sea-level thrust against a
real 7,607 kN, a lift-off thrust-to-weight of 1.40, and 11.54 km/s of ideal
velocity change. The seeded hydrolox study is refused outright: one RD-180
under a 411 t tank gives a thrust-to-weight of 0.77, and a vehicle that cannot
leave the pad reaches nothing, whatever its Δv.

---

## Datasets

A researcher creates a dataset two ways, and both are immutable the moment they
are recorded.

**Upload a file.** Drop a CSV, TSV or JSON file onto a project. It is parsed in
the browser: the delimiter is detected, quoted fields containing commas and
newlines are handled, column types are inferred, and a SHA-256 digest is taken
of the bytes. Nothing is recorded until the columns, the types, the row count,
the digest, a preview and any parse warnings have been shown and confirmed.
Provenance names the file, the uploader and the time, and states that the
platform makes no claim about the licence or accuracy of the contents.

**Freeze a query.** The result of a saved query is recorded with its parameters,
its sources and their retrieval times, and the thresholds in force.

The two differ in one honest respect: an uploaded dataset stores its rows,
because the file cannot be fetched again, so it can be previewed and exported in
full. A query snapshot stores the query, because re-running it against the named
sources reproduces the rows.

---

## Fixture data

`src/mock/seed-objects.js` carries 62 catalogue entries. Names and catalogue
numbers are real so the catalogue is recognisable; **all orbital elements are
generated locally** and are not observations. Launches, space weather, accounts,
stations and workspaces are fixtures too, and every screen that shows them
carries a fixture notice.

The vehicle component library is the exception: those figures are published
specifications for real hardware, named per part, because a library of invented
masses would make the staging analysis worthless.

Element sets are generated with an epoch close to the current time and a right
ascension of the ascending node drawn around the two terminator planes, which is
the geometry in which a satellite is lit while the observer is in darkness. One
object in eight is deliberately left stale so the freshness banding is visible
rather than being a rule nobody sees fire.

The sidebar footer rebuilds every fixture from its seed.

---

## Not in scope

SpaceNova performs no conjunction screening and no collision assessment, and is
not certified for operational, navigational or safety-critical use. Propagation
from public element sets gives kilometre-scale accuracy that degrades with epoch
age; the interface states the uncertainty rather than hiding it.

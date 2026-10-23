# SRS impact of the role trim and the two new features

What changed in the front end, expressed as edits the SRS needs. Written to be
worked through section by section against the skeleton in
[SRS-handoff-prompt.md](SRS-handoff-prompt.md).

Nothing here is a suggestion about *whether* to cut. The cuts are done; this is
the list of claims the document currently makes that the software no longer
supports, and the new claims it should make instead.

---

## 1. Screens per role, before and after

| Role | Before | After |
| --- | --- | --- |
| Guest (public routes) | 11 | 6 |
| Observer | 16 | 8 |
| Researcher | 17 | 9 |
| Engineer | 22 | 12 |
| Administrator | 32 | 13 |

Seventeen page components were deleted, one was added, and the administrator
lost the Research and Engineering sections that the privilege table never
granted.

---

## 2. Section 2.5, the domain spine

**Remove the Watchlist element.** It no longer exists. An Observation plan now
holds its space objects directly:

> **Observation plan** — a plan for one observer location over a date range,
> holding an ordered set of space objects; it holds a set of candidate windows.

Every later reference to "watchlists" in sections 4, 5 and the appendices
becomes "the objects on a plan".

**Add two elements:**

> **Vehicle design** — an Engineer-owned ordered stack of vehicle components,
> bottom stage first. Components are engines, tanks, strap-on boosters,
> interstages, fairings, adapters and payloads, each carrying published dry
> mass, propellant mass, thrust and specific impulse at sea level and in
> vacuum, diameter and length. An interstage is a separation plane: it ends the
> stage below it, so the stack itself expresses the staging.

> **Uploaded dataset** — a dataset created from a file rather than from a
> query. It records the filename, the detected format and delimiter, the
> inferred columns and their types, the full row count, a SHA-256 digest of the
> file's bytes, and the rows themselves. It is immutable from the moment it is
> recorded, exactly as a frozen query snapshot is.

**Amend the Dataset element** so it covers both origins: a dataset is either
frozen from a query or uploaded as a file.

---

## 3. Section 2.6, the user classes and privilege table

**Remove the role-upgrade request flow entirely.** Section 3.2 currently says
"There is a **role-upgrade request flow**: a User requests the Researcher or
Engineer role with a justification, and an Admin approves or rejects it."
Delete that sentence and everything downstream of it: the request entity, its
states (pending, approved, rejected), the decision note, the administrator
review screen, and the requirements in SYS-AUTH and SYS-ADM that carry them.

A role is now simply an attribute of an account that an administrator sets from
the accounts screen. Nobody can request one. The screen shown when a user
reaches an area their role does not cover explains that and offers a way back,
rather than a form.

**Administrator.** The implementation gave the admin role the `research` and
`engineering` capabilities, which contradicted the document's own statement
that every account has exactly one role. That is corrected: an administrator
now holds `public`, `observe` and `admin` only. The privilege table should show
no administrator tick against private research workspaces, element-set
diagnostics, ground stations or the vehicle builder.

**Observer.** Remove watchlists and alert subscriptions from the description.

**Researcher.** Add uploading a dataset file. Remove the shareable read-only
link.

**Engineer.** Remove configurable telemetry dashboards and anomaly thresholds.
Add launch vehicle design and staging analysis.

The privilege table as implemented is now:

| Capability | Guest | Observer | Researcher | Engineer | Admin |
| --- | :-: | :-: | :-: | :-: | :-: |
| Browse the public catalogue and launch schedule | ● | ● | ● | ● | ● |
| Live tracking | | ● | ● | ● | ● |
| Observer locations | | ● | ● | ● | ● |
| Observation planning and logs | | ● | ● | ● | ● |
| Private research workspaces | | | ● | | |
| Immutable dataset snapshots and citation export | | | ● | | |
| Upload a dataset to a project | | | ● | | |
| Invite collaborators to a project | | | ● | | |
| Element-set history and staleness diagnostics | | | | ● | |
| Decay and re-entry estimates | | | | ● | |
| Ground station configuration | | | | ● | |
| Launch vehicle design and staging analysis | | | | ● | |
| Manage accounts and set roles | | | | | ● |
| Manage catalogue, data sources and ingestion | | | | | ● |
| Edit global thresholds and settings | | | | | ● |
| Read the audit log | | | | | ● |

(The source of truth is `ROLE_MATRIX` in `src/mock/people.js`, and the
capabilities in `src/context/AuthContext.jsx`.)

---

## 4. Section 3.3, the functional module list

The fifteen-module list becomes thirteen. Two modules are removed outright, two
shrink, and one is added.

| # | Module | ID prefix | Status |
| --- | --- | --- | --- |
| 1 | Authentication, Accounts and Role Management | SYS-AUTH | **reduced** |
| 2 | Dashboard | SYS-DASH | amended |
| 3 | Space Object Catalog and Search | SYS-CAT | amended |
| 4 | Live Tracking and Visualization | SYS-TRK | amended |
| 5 | Pass Prediction and Observation Planning | SYS-PASS | amended |
| 6 | Launch Database | SYS-LAUNCH | **renamed and reduced** |
| ~~7~~ | ~~Astronomy Events Calendar~~ | ~~SYS-EVT~~ | **removed** |
| ~~8~~ | ~~Space Weather~~ | ~~SYS-SWX~~ | **removed as a module** |
| ~~9~~ | ~~Telemetry Visualization~~ | ~~SYS-TLM~~ | **removed** |
| 7 | Engineering Analysis and Ground Stations | SYS-ENG | reduced |
| 8 | **Launch Vehicle Design** | **SYS-VEH** | **new** |
| 9 | Research Workspaces | SYS-WSP | amended |
| ~~12~~ | ~~Alerts and Notifications~~ | ~~SYS-ALRT~~ | **removed** |
| 10 | Data Ingestion, Caching and Provenance | SYS-DATA | amended |
| 11 | Profile and Settings | SYS-PROF | reduced |
| 12 | Administration | SYS-ADM | reduced |

### Module 6, Mission and Launch Database → Launch Database

The separate mission register is gone: `Missions.jsx`, `MissionDetail.jsx`, the
`missions` API namespace and the `MISSION_SEED` fixtures were all deleted. A
launch record carries its own payload, destination, provider, pad and outcome,
which is everything the surviving screens asked of it. Drop every requirement
about mission phases, milestones, instrument counts and agency filters, and the
"linked mission" panel on a launch.

### Module 7, Astronomy Events Calendar — removed

The calendar of meteor showers, eclipses, conjunctions and lunar phases is
gone, along with its screen and its fixtures. **One piece survives and should
be rehomed, not deleted:** the sky-conditions calculation (solar elevation,
the twilight threshold crossing, and moon phase and illumination at an observer
location) still runs, because the application shell header and the dashboard
both report whether the sky at the active site is dark enough to observe. Move
those requirements into Module 2, Dashboard. The engine functions behind them
(`src/engine/sun.js`) are untouched.

### Module 8, Space Weather — removed as a module

There is no space weather screen. The data has **not** gone: the planetary K
index, F10.7 and the derived values are still fetched, still carry their
provenance, and still feed two things — the dashboard's conditions tile, and
the atmospheric density scaling in the decay model
(`activityFactor` in `src/engine/decay.js`). So space weather moves from being
a functional module to being a **data source** in Module 10 (Data Ingestion),
plus one requirement in Module 2 (Dashboard) and one in Module 7 (Engineering
Analysis). Delete the requirements about the flare and CME log, the three-day
outlook screen and the aurora map.

### Module 9, Telemetry Visualization — removed

This is the largest single deletion and the one worth being deliberate about,
because the document built an integrity principle around this module: *"the
system shall never present a computed or estimated value as a measured one."*

That principle must **not** be deleted with the module. It is still enforced
everywhere — every panel that shows a derived figure still carries its source
tag and its data age, and the new staging analysis states its method and its
assumptions on screen. Move the principle up into the non-functional
requirements (section 6, provenance and integrity) where it belongs, rather
than leaving it attached to a module that no longer exists.

Deleted with the module: derived telemetry series, per-channel definitions,
Doppler shift panels, anomaly thresholds on telemetry channels, and the alert
rules that fired from them.

### Module 10, Engineering Analysis and Ground Stations — reduced

Station **pass scheduling with conflict detection** as a destination is gone:
`StationSchedule.jsx` and the `stations.schedule` endpoint were deleted. A
station's own bookings are still listed on its detail screen, still flagged
when they conflict, and still cancellable, so keep the booking requirements but
scope them to the station record. Drop the requirements about a cross-station
schedule view and bulk conflict resolution.

Element-set history, staleness diagnostics, propagation residuals, and decay
and re-entry estimates are all unchanged.

### New module, Launch Vehicle Design (SYS-VEH)

An Engineer assembles a launch vehicle from a library of components and reads
back what it can reach.

Requirements to write, roughly ten to twelve:

- The system shall provide a library of launch vehicle components, each
  recording the published specification its figures were taken from.
- A design shall be an ordered stack of components, bottom first, built by
  dragging components from the library into the stack, and reorderable by
  dragging within it. Equivalent keyboard controls shall exist for adding,
  moving and removing a component.
- An engine or booster placed in the stack shall carry a count, so a stage of
  nine identical engines is one entry.
- The system shall derive the staging from the stack: an interstage ends the
  stage below it, and its mass stays with that stage after separation.
- The system shall compute, per stage, the velocity change from the ideal
  rocket equation, the thrust-weighted effective specific impulse, the thrust,
  the thrust-to-weight ratio at ignition, the burn time from mass flow, the
  mass ratio and the structural mass fraction.
- The first stage shall be rated at sea level and every stage above it in
  vacuum.
- The system shall report total velocity change against a budget of mission
  targets (low Earth orbit, sun-synchronous orbit, geostationary transfer,
  trans-lunar injection, Earth escape) and state the margin against each.
- The system shall state that the budgets include gravity, drag and steering
  losses and that no trajectory is integrated. **This is the same integrity
  requirement as the old telemetry module's**: a computed figure is labelled as
  computed, with its method.
- The system shall validate a design and report: a stage with propellant and no
  engine, a stage with an engine and no propellant, a vacuum engine used as a
  first stage, a lift-off thrust-to-weight below 1.0 (an error) or below 1.2 or
  above 2.2 (a warning), a fairing with vehicle hardware above it, a diameter
  mismatch between adjacent load-bearing structures, and a stage that is more
  than a third structure by mass.
- A design with any error shall be reported as unflyable regardless of its
  velocity change.
- A design shall be saveable, listable, reloadable and deletable, and shall
  store component identifiers rather than copies, so a correction to a
  published figure propagates to every design using that component.

**The vehicle is drawn to scale, and the drawing is the editing surface.**
Further requirements:

- The system shall draw the vehicle to scale from each component's published
  diameter and length, against a height scale in metres, with the base of the
  stack at ground level and one scale applied to both axes so proportions are
  not distorted.
- The builder shall occupy the full application frame rather than the page
  column, with the component library and the analysis collapsible either side
  of the drawing.
- The drawing shall be a continuously zoomable and pannable view: zoom at the
  pointer, pan by dragging, fit to the vehicle, and zoom to at least 10x.
- The height scale shall be recomputed from the live view rather than fixed, so
  the tick interval refines as the view is zoomed in and the scale is honest at
  every magnification.
- Decorative elements of the scene (the pad deck, the service tower, the
  exhaust glow, the starfield) shall be identified as scenery and shall not
  obscure or stand in for any computed value.
- A component shall be added by dragging it from the library onto the drawing,
  and the insertion point shall be shown before the drop is made.
- A component already on the vehicle shall be reorderable by dragging it within
  the drawing, selectable by clicking it, and removable once selected.
- The system shall lay out a fairing so that it ENCLOSES the payload and any
  adapter beneath it, rather than stacking above them, and shall draw the
  enclosed items inside it.
- The system shall mount strap-on boosters alongside the core rather than in
  line, with their bases level with the base of the stage they fire with, and
  shall report an odd number of them as an asymmetric thrust line.
- The system shall compute and mark the **centre of gravity** as the
  mass-weighted centroid of the stack.
- The system shall compute and mark the **centre of pressure** using
  Barrowman's equations with the body-lift correction, and shall report the
  static margin in calibers.
- The system shall state plainly when a design is aerodynamically unstable, and
  shall explain that nearly every orbital launch vehicle is, and that they fly
  on engine gimbal rather than on static stability. **This is the integrity
  requirement again**: a figure that looks like a failure is explained rather
  than hidden or quietly clamped.
- Where Barrowman's method yields a centre of pressure outside the vehicle, the
  system shall report it as unavailable rather than display it.

**Verification note for section 6.7.** The analysis is checkable against real
vehicles, and the seeded designs exist to make that checkable. The Falcon 9
arrangement returns 553.9 t gross lift-off mass (real: ~549 t), 7,605 kN of
sea-level thrust (real: 7,607 kN), a lift-off thrust-to-weight of 1.40, and
11.54 km/s of ideal velocity change. Write that as an acceptance criterion.

### Module 11, Research Workspaces — amended

**Remove:** the shareable read-only link, the public shared-project view, link
expiry and link revocation. `SharedProject.jsx`, the share-link API and the
fixtures are gone. A workspace now reaches other people only through its
invited collaborators, who still have read or edit access.

**Add:** dataset upload.

- A researcher shall be able to add a dataset to a project by uploading a CSV,
  TSV or JSON file.
- The file shall be parsed in the browser. Nothing shall be recorded until the
  researcher has seen the detected format, the inferred columns and types, the
  row count, the file digest, a preview of the first rows and any parse
  warnings, and has confirmed.
- The system shall detect the delimiter (comma, tab, semicolon or pipe), handle
  quoted fields containing delimiters and newlines, and accept JSON as either
  an array of objects or an object wrapping one.
- The system shall infer a type per column (integer, number, boolean,
  timestamp, text) and record it with the dataset.
- The system shall report, rather than silently accept: duplicate or blank
  column headings, rows with the wrong number of values, JSON rows missing
  fields, and nested values recorded as JSON text.
- The system shall compute a SHA-256 digest of the file and record it, naming
  the algorithm. Where the browser offers no such primitive the system shall
  record a weaker digest **under its own name** rather than claim a checksum it
  did not compute.
- An uploaded dataset shall be immutable from the moment it is recorded. A
  corrected file produces a new dataset beside it.
- Provenance for an uploaded dataset shall name the file, the uploader and the
  time, and shall state that the platform makes no claim about the licence or
  the accuracy of the contents.
- Where a dataset holds rows, the system shall display them and export them as
  CSV with the citation block, or as JSON with the provenance alongside.

**Note on a real asymmetry**, which the SRS should state rather than paper
over: an uploaded dataset stores its rows, because the file cannot be fetched
again. A query snapshot stores the query, the row count and the thresholds,
because re-running it against the named sources reproduces the rows. Both are
immutable; only one holds a copy of the data.

### Module 12, Alerts and Notifications — removed

Alert rules, the delivery history, the unread count in the header and the
dashboard notifications panel are all gone, along with `Alerts.jsx`, the
`alerts` API and the fixtures. Email delivery for alerts goes with it; the
email service is still an external system for **verification and password
reset only**, so amend the external-systems list in section 3.3 rather than
removing it.

### Module 14, Profile and Settings — reduced

The preferences screen and the export-history screen were deleted. Units and
time display moved into the account bar, one click from any screen. Map
projection and the six notification switches are gone with their screens.

**Export changed from a promise to a behaviour**, which is an improvement worth
recording: the old export screen queued a job that Phase 2 was going to
deliver. The observation log and a dataset now build the file in the browser
and hand it over immediately. Rewrite the export requirements accordingly, and
drop the export-history and retention requirements.

### Module 15, Administration — reduced

**Removed:** platform analytics, content management (launch, mission and event
records are no longer editable; launches come from the ingestion feed) and
shared-content moderation, which had nothing left to moderate once share links
were removed.

**Also removed:** the role-upgrade request queue, with the whole request flow.

**Kept, unchanged:** accounts (including setting an account's role), catalogue
administration, data sources and ingestion control, global thresholds, and the
append-only audit log. The audit log still records a role change; it no longer
records an approval or a rejection, because there is nothing to approve.

---

## 5. Section 6, non-functional requirements

- **Move the integrity principle** out of the deleted telemetry module and into
  section 6 as a cross-cutting requirement, as described above.
- The **provenance** requirements are unchanged and now cover two more cases:
  an uploaded file, and a figure computed by the staging analysis.
- The **degraded mode** requirements are unchanged.
- The **privacy** requirements lose the public-share-link clauses.

---

## 6. Appendix A, the technical core

Add a section for the staging analysis, beside the existing ones on
propagation, visibility, scoring and decay:

> **A.11 Staged velocity change.** Per stage, Δv = I_sp · g₀ · ln(m₀/m_f),
> where m₀ is the stage at ignition including every stage above it and the
> payload, and m_f is the same less the stage's propellant. Effective specific
> impulse across several engines is thrust-weighted, ΣF / Σ(F/I_sp), because
> mass flows add. Mass flow is F/(I_sp·g₀), so burn time is the propellant load
> divided by it. Thrust-to-weight at ignition is F/(m₀·g₀). Standard gravity is
> 9.80665 m/s². Gravity, drag and steering losses are not integrated; they are
> carried inside the mission Δv budgets, which is how a vehicle is sized on
> paper.

> **A.12 Balance.** The centre of gravity is the mass-weighted centroid of the
> stack, each component treated as uniform along its own length. The centre of
> pressure follows Barrowman: the nose contributes CN = 2(d_base/d_ref)²
> acting at 0.466 L for an ogive or 0.666 L for a cone, each change of diameter
> contributes CN = 2[(d_aft/d_ref)² − (d_fore/d_ref)²] at the standard conical
> shoulder position, and a parallel tube contributes nothing. Because a launch
> vehicle is mostly parallel tube, the Galejs body-lift term is added:
> CN = 1.1·A_plan/A_ref at each section's centroid. Without it the nose and a
> wide fairing's shoulder very nearly cancel and the result runs outside the
> vehicle. The static margin is (x_CoG − x_CoP)/d_ref, in calibers, positive
> when the vehicle is statically stable. A small angle of attack and subsonic
> flow are assumed, and the transonic rearward shift is not modelled.

Implemented in `src/engine/vehicle.js` and `src/engine/vehicle-geometry.js`,
both pure, with no React, no network and no fixtures, like the rest of the
engine.

---

## 7. Appendix D, the prototype screens

Remove the screen prototypes for: astronomy events, space weather, missions and
mission detail, the shared project view, the look-up view, watchlists, alerts,
exports, preferences, telemetry, anomaly thresholds, station schedule, platform
analytics, content management, shared-content moderation, and the role-request
queue and its request form.

Add: the vehicle builder (component library on the left, the vehicle drawn to
scale in the middle as the editing surface, the analysis on the right) and the
dataset upload dialog.

---

## 8. Requirement count

The handoff prompt targets 110 to 130 numbered requirements across fifteen
modules. After this trim, thirteen modules and roughly **85 to 100**
requirements is the honest number. Revise the target rather than padding the
surviving modules to hit the old one.

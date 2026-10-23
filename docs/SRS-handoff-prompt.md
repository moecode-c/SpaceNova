# Prompt to send to the SRS-writing chat

> Copy everything below the line. Attach `TypeFlow_SRS.docx`, `SRS Template.docx` and
> `04-Chap4-Requirements engineering.pptx` to that chat as well if you can — the prompt
> works without them, but they help it match the house style exactly.

---

You are writing a complete university Software Requirements Specification (SRS) document. Produce the finished document, not a plan or an outline. Do not ask me clarifying questions: everything you need is below, and where a value is not specified you must choose a sensible default and label it as "a default value that the team will tune" (this is the convention the document uses throughout).

## 1. What the document is for

This is a Software Engineering course deliverable, graded against Sommerville's *Software Engineering*, Chapter 4 (Requirements Engineering). It must obey the following rules from that chapter, because the grader checks them:

- **User requirements** are statements in natural language, understandable by a non-technical reader, of what services the system provides and its operational constraints.
- **System requirements** are a structured, detailed specification of the system's functions, services and operational constraints. Each requirement is a **single numbered sentence expressing exactly one requirement**. Never amalgamate two requirements into one sentence.
- Use **"shall"** for mandatory requirements, **"should"** for recommended, **"may"** for optional. Use these words consistently and never any other modal.
- Keep functional and non-functional requirements **strictly separate**. Do not let an NFR leak into the functional sections.
- Every **non-functional requirement must be verifiable**: it states a measure that can be objectively tested (time in ms, percentage, count, number of concurrent users). Never write an unverifiable goal such as "the system should be easy to use". If you want to express ease of use, express it as a measurable statement.
- Classify non-functional requirements using Sommerville's taxonomy where it is natural: **product**, **organisational** and **external** requirements.
- Supplement natural language with the notations the chapter approves: **structured / form-based specification** (for use cases), **tabular specification** (for sets of alternative courses of action) and **graphical notation placeholders** (UML-style use cases and models).
- Add a short **rationale in parentheses** after roughly the 15 to 20 most critical system requirements, explaining why the requirement is necessary. The chapter explicitly recommends this.
- The document states **what** the system does, not **how** it is coded. Design-level detail belongs in the appendices, clearly marked as design notes or constraints.

## 2. The mandatory section skeleton

The course template fixes the main body. It must be exactly these six numbered sections, in this order:

1. Preface
2. Introduction
3. Similar Systems
4. Functional User Requirements
5. Functional System Requirements
6. Non-functional Requirements

Before section 1 there is a title page, a **Document History** table and a **Contents** list. After section 6 there are appendices **A to K**. Use this exact appendix set:

- Appendix A — Orbital Propagation, Visibility and Pass Scoring Specification
- Appendix B — Technical Requirements and System Constraints
- Appendix C — System Models
- Appendix D — Prototype of Forms and Pages
- Appendix E — Scenarios
- Appendix F — Use Cases
- Appendix G — Tabular Specification
- Appendix H — Assumptions, Dependencies and Risks
- Appendix I — Future Enhancements
- Appendix J — Conclusion
- Appendix K — References

Section 2 (Introduction) has these subsections: 2.1 Purpose, 2.2 Objectives, 2.3 Project Scope (an "In scope" list and an "Out of scope (this version)" list), 2.4 System Overview, 2.5 Catalog, Targets, Plans and Workspaces, 2.6 User Classes and Characteristics, 2.7 Glossary.

## 3. The system: SpaceNova

**SpaceNova** is a scalable space-data web platform. It brings satellite tracking, mission and launch records, astronomy events, space weather, observation planning, telemetry visualization and private research workspaces into one application, and it computes its own orbital predictions rather than only displaying numbers fetched from elsewhere.

### 3.1 The domain spine

Define the domain structure in **section 2.5, titled "Catalog, Targets, Plans and Workspaces"**, with a table of elements and a second table giving an initial catalogue of tracked object groups. Every later section must refer back to these terms.

- **Space object** — an entry in the catalog: a satellite, rocket body or debris object identified by NORAD catalog number and COSPAR/international designator, carrying a name, object type, operator, launch date, orbit class (LEO, MEO, GEO, HEO), status (active, inactive, decayed) and its current orbital element set.
- **Element set (TLE)** — a dated two-line element set for one object, with an epoch, a source and a freshness state (fresh, usable, stale, expired).
- **Observer location** — a named geodetic position (latitude, longitude, altitude) with a timezone and an optional horizon obstruction mask.
- **Watchlist** — a user's named, ordered collection of space objects.
- **Observation plan** — a plan for one observer location over a date range, built from one or more watchlists; it holds a set of candidate windows.
- **Pass / observation window** — one predicted appearance of one object above the observer's minimum elevation, with AOS, time of closest approach, LOS, maximum elevation, duration, illumination state, estimated magnitude and a computed pass-quality score. Status: predicted, planned, observed, missed, cancelled.
- **Observation log entry** — what the user actually recorded for a planned window: outcome, conditions, notes, optional image reference.
- **Ground station** — an Engineer-owned station: location, antenna configuration, minimum elevation, frequency bands, and a schedule of booked passes.
- **Workspace** — a Researcher-owned private container. Holds **projects**, each with **datasets** (immutable snapshots of query results with provenance), **saved queries**, **notes** and **collaborators**.
- **Data source** — an external provider with a name, endpoint, licence, refresh interval, rate limit and health state.

Threshold values (minimum elevation, twilight threshold, freshness bands, scoring weights, retention periods) are **stored as data, so administrators can change them without code changes**. State this explicitly in 2.5, because it feeds the scalability and administration requirements later.

### 3.2 User classes

Five classes. Every account has exactly **one** role. Researcher and Engineer are both supersets of User. There is a **role-upgrade request flow**: a User requests the Researcher or Engineer role with a justification, and an Admin approves or rejects it. Put this in a table in section 2.6 with columns: user class, description, expected skill, main privileges.

- **Guest** — not logged in. Views the landing page, the public object catalog, the launch and mission database, the astronomy events calendar, the current space weather summary, and any workspace or report shared by a public link. Can register and log in.
- **User (Observer)** — a registered enthusiast or student. Sets observer locations, builds watchlists, uses live tracking, requests pass predictions, creates observation plans, records observation logs, subscribes to alerts, sees the events calendar localised to their location, and exports their own data.
- **Researcher** — everything a User has, plus private research workspaces: projects, datasets as immutable snapshots with full provenance, saved queries, notes, invited collaborators with read or edit access, and exports that carry a citation block naming every data source and its retrieval date.
- **Engineer (Mission and Telemetry Engineer)** — everything a User has, plus engineering views: complete element-set history with epoch and staleness diagnostics, propagation residuals against later element sets, orbital decay and re-entry window estimates, ground station and antenna configuration, station pass scheduling with conflict detection, configurable telemetry dashboards, and anomaly thresholds with alert rules on telemetry channels. No platform administration rights.
- **Admin** — manages user accounts and roles, approves role-upgrade requests, manages the object catalog and data sources, controls ingestion jobs and the cache, maintains mission, launch and astronomy-event records, edits global thresholds and settings, moderates publicly shared workspaces and reports, reads the audit log, and views platform analytics.

External systems: the external space-data providers listed in B.3, and an email service for verification, password reset and alert delivery.

### 3.3 Functional modules

Sections 4 and 5 both follow this module list, in this order, with the same subsection titles in both sections. Section 4 gives each module one prose paragraph of user requirements. Section 5 gives each module a table of numbered system requirements with columns ID, Requirement, Pri. Use these requirement ID prefixes:

| # | Module | ID prefix |
|---|---|---|
| 1 | Authentication, Accounts and Role Management | SYS-AUTH |
| 2 | Dashboard | SYS-DASH |
| 3 | Space Object Catalog and Search | SYS-CAT |
| 4 | Live Tracking and Visualization | SYS-TRK |
| 5 | Pass Prediction and Observation Planning | SYS-PASS |
| 6 | Mission and Launch Database | SYS-MISS |
| 7 | Astronomy Events Calendar | SYS-EVT |
| 8 | Space Weather | SYS-SWX |
| 9 | Telemetry Visualization | SYS-TLM |
| 10 | Engineering Analysis and Ground Stations | SYS-ENG |
| 11 | Research Workspaces | SYS-WSP |
| 12 | Alerts and Notifications | SYS-ALRT |
| 13 | Data Ingestion, Caching and Provenance | SYS-DATA |
| 14 | Profile and Settings | SYS-PROF |
| 15 | Administration | SYS-ADM |

Notes on individual modules, so the content is right:

- **Live Tracking and Visualization**: a 2D map with ground track and instantaneous footprint, and a 3D globe view; position updates computed in the browser from the cached element set rather than polled from the server; a selectable set of simultaneously tracked objects; a "look up" view giving azimuth, elevation, slant range and range-rate for the active observer location.
- **Telemetry Visualization** means **computed state and public feeds, never fabricated data**. Panels show values derived from propagation (position, velocity, altitude, ground track, footprint radius, eclipse state, pass geometry, range-rate and Doppler shift) together with real public feeds (space weather indices, launch status). Every panel **shall display its data source and the age of the data**, and the system **shall never present a computed or estimated value as a measured one**. Write explicit requirements for this; it is a correctness and integrity property of the system, and also an entry in the privacy and provenance NFRs.
- **Data Ingestion, Caching and Provenance** is the module that carries the external-dependency risk. It covers scheduled refresh per data source, rate-limit compliance, response validation before storing, a cache with a time-to-live per source, a recorded provenance record (source, endpoint, retrieval time, licence) for every stored record, a **degraded mode** that serves the last known good cached data with a visible staleness banner when a source is unreachable, and health monitoring per source.
- **Research Workspaces**: creating projects, running and saving queries, freezing a query result as an immutable dataset snapshot, writing notes that reference datasets, inviting collaborators with read or edit access, generating a shareable read-only link that an Admin can revoke, and exporting a project as CSV/JSON plus a citation block.
- **Administration**: everything in the Admin privilege list above, plus an append-only audit log of administrative actions.

Target volume for section 5: **110 to 130 requirements** across the fifteen modules, each with a priority **M = must, S = should, C = could**. Authentication alone should carry about a dozen; the signature modules (Pass Prediction, Data Ingestion, Telemetry, Engineering, Workspaces) ten to fifteen each; small modules five to eight.

### 3.4 Section 3, Similar Systems

Compare five systems, each in its own subsection with a short description, a "Similarity" line and a "Difference" line, then a comparison table (3.6 Comparison Summary) with SpaceNova as the first column:

1. **N2YO** — live tracking and pass predictions in the browser.
2. **Heavens-Above** — visual pass predictions with magnitude and sky charts for an observer location.
3. **Celestrak and Space-Track.org** — the authoritative element-set and catalog data sources.
4. **Stellarium Web and NASA Eyes on the Solar System** — sky and solar-system visualization.
5. **SpaceWeatherLive together with The Space Devs / Next Spaceflight** — space weather dashboards and launch schedules.

Optionally add **SatNOGS** as a sixth, for its ground-station network and satellite metadata.

Comparison table rows (aspects): main purpose; live tracking; visual pass prediction with illumination and magnitude; 3D globe; mission and launch database; astronomy events calendar; space weather; derived telemetry panels; private research workspaces with dataset snapshots; data provenance and citation on export; configurable alerts; ground-station scheduling; role-based access. Open the section with the caveat that the comparison is based on the public websites of each system at the time of writing and should be re-checked before submission. Where you are not certain of a competitor's capability, write "not specified" rather than guessing.

SpaceNova's defensible differences, to be made explicit: it **computes** predictions itself with a documented, testable algorithm instead of only displaying third-party output; it **scores and ranks** observation windows rather than only listing them; it carries **provenance and freshness on every value**; and it is the only one of the five that combines tracking, missions, events, space weather and **private research workspaces with citable dataset snapshots** under role-based access.

## 4. Appendix A — the technical core

This is the appendix that makes the document look like a real SRS: concrete formulas, named default values, and a statement of limitations. Open it with a line saying that all default values are initial estimates, tuned by the validation described in A.11. Structure:

- **A.1 Time and Coordinate Frames** — TLE epoch handling, UTC and Julian date, Greenwich Mean Sidereal Time, the TEME to ECEF rotation, the observer's WGS-84 geodetic position to ECEF, and the ECEF to topocentric East-North-Up transform. Give the formulas.
- **A.2 Propagation** — SGP4 for near-Earth objects and SDP4 for deep-space objects, selected by orbital period; propagation step size (default 10 s for scanning, refined later); maximum propagation horizon (default 10 days from the element-set epoch, after which the system refuses to predict).
- **A.3 Look Angles** — azimuth, elevation, slant range and range-rate from the topocentric vector, with formulas; Doppler shift from range-rate for a given downlink frequency.
- **A.4 Pass Detection** — scan for elevation crossing the minimum elevation threshold (default 10 degrees), then refine AOS, time of closest approach and LOS by bisection to an accuracy of 1 s; record maximum elevation, duration, and azimuth at AOS and LOS.
- **A.5 Visibility Conditions** — a pass is *visible* (as opposed to merely *above the horizon*) only when all of: maximum elevation is at or above the minimum elevation; the satellite is **not in Earth's shadow** (give the conical or cylindrical shadow test using the sun vector, the satellite position and the Earth radius); the **observer is in darkness** (sun elevation at or below a configurable threshold, default -12 degrees for nautical twilight, with -6 degrees civil twilight offered as an alternative setting); and the pass is not blocked by the observer's **horizon obstruction mask**. Specify each condition as a separate testable clause.
- **A.6 Estimated Visual Magnitude** — a simplified standard-magnitude model accounting for slant range and phase angle, presented explicitly as an **estimate** with a stated uncertainty, not a measurement.
- **A.7 Element-Set Freshness and Accuracy** — epoch age bands with default values: **fresh** under 24 hours, **usable** under 7 days, **stale** at 7 days or more, **expired** beyond the propagation horizon; a stated growth of positional error with epoch age (give an order-of-magnitude figure, described as typical rather than exact, and note that it is larger for low-perigee, high-drag objects); the rule that every prediction is labelled with the freshness band of the element set it came from, and that the system refuses predictions from expired element sets.
- **A.8 Pass Quality Score** — the ranking function. Use a form such as: quality = w1 x clip(normalised maximum elevation) + w2 x clip(normalised duration) + w3 x illumination term + w4 x (1 - cloud-cover penalty) - w5 x staleness penalty, with every term normalised to the range 0 to 1, default weights given, and the resulting score mapped to bands (excellent, good, fair, poor). State which terms are omitted when cloud-cover data is unavailable and how the score is renormalised.
- **A.9 Scheduling and Conflict Resolution** — how overlapping windows for one observer location or one ground station are resolved: the higher-quality window wins, a minimum turnaround gap between consecutive passes (default 2 minutes), and the rule for what happens to the window that loses.
- **A.10 Orbital Decay and Re-entry Estimate** (Engineer feature) — the inputs used (perigee altitude, mean motion derivative, ballistic coefficient, solar activity index F10.7 and geomagnetic Kp from the space weather module), the output as a **window** rather than a single date, and an explicit statement that it is an estimate unsuitable for operational re-entry planning.
- **A.11 Validation, Tuning and Limitations** — how the team will check the engine: compare computed passes for a set of reference objects against an independent source over a fixed period, record the differences in AOS, LOS and maximum elevation, and state the accuracy budget achieved. Then state the limitations plainly: SGP4 with public element sets gives kilometre-scale accuracy that degrades with epoch age; magnitude is an estimate; cloud cover comes from a general weather forecast and not from a sky-quality sensor; **the system performs no conjunction screening or collision assessment and must not be used for any operational or safety-critical purpose.**

## 5. Appendix B — technical requirements and constraints

- **B.1 Technology Stack** — a two-column table (layer, technology). The stack is **MERN in JavaScript, not TypeScript**:
  - *Front end*: React with Vite, JavaScript (ESM), React Router, TanStack Query, Axios, Tailwind CSS with shadcn/ui, React Hook Form with a schema validator, a 2D map library (Leaflet or MapLibre GL), a 3D globe library (CesiumJS or react-globe.gl over three.js), a charting library (Recharts), satellite.js for SGP4/SDP4, an astronomy library for sun, moon and solar-system events, and date-fns with timezone support.
  - *Back end*: Node.js with Express (JavaScript, ESM), Mongoose, a request-validation library (Joi), bcrypt, jsonwebtoken, a scheduler for ingestion jobs (node-cron, or BullMQ with Redis if a queue is justified), Server-Sent Events or Socket.IO for live updates, Helmet, express-rate-limit, Winston for logging.
  - *Database*: MongoDB (Atlas free tier in development) through Mongoose. Call out three MongoDB-specific design choices, because they earn marks: **time-series collections** for telemetry samples and space weather history, **TTL indexes** for cached propagation results and expired element sets, and a **2dsphere index** on observer locations and ground-track geometry for geospatial queries.
  - *Testing*: Jest with Supertest for the API, Vitest with React Testing Library for the front end, and unit tests for the propagation, visibility and scoring functions against known reference values.
  - *Tooling*: Docker for MongoDB and a local mail inbox, GitHub with a protected main branch and pull-request review, GitHub Actions running lint, tests and build, ESLint with Prettier, JSDoc for shared type documentation.
  - *Hosting*: a static host for the front end, a Node host for the API, MongoDB Atlas for the database; final choice left to the team.
- **B.2 Hardware and Software Requirements** — client: a desktop, laptop or tablet with a current browser, WebGL 2 support for the 3D globe, and an internet connection; the 3D globe requires hardware acceleration and the system falls back to the 2D map where it is unavailable. Server: a Node.js runtime, a MongoDB instance, and outbound HTTPS to the data providers.
- **B.3 External Interfaces** — one entry per provider, each stating what it supplies, the access method, the authentication, the rate limit and the licence or attribution obligation: Celestrak general-perturbation element sets; Space-Track.org (account required, with its user agreement as a constraint); The Space Devs / Launch Library for launches and missions; NOAA SWPC for geomagnetic, solar wind and X-ray data and aurora forecasts; NASA open APIs for imagery, near-Earth objects and space-weather notifications; a solar-system ephemeris source for planetary and eclipse events; a weather provider for cloud cover at observer locations; optionally SatNOGS for satellite metadata and transmitter data; and an SMTP service for email.
- **B.4 System Constraints** — a development window of about 6 to 8 weeks for a student team; free tiers only, so provider rate limits, request quotas and sleeping free services must be designed around; element-set accuracy and the absence of public live telemetry for most objects bound what the system can honestly claim; browser WebGL capability bounds the 3D view; the team's experience level with orbital mechanics and MongoDB is reflected in the schedule.
- **B.5 Phased Delivery** — state plainly that this SRS specifies the complete client-server system, and that delivery is phased: **Phase 1 of this term implements the React front end**, computing propagation in the browser with satellite.js and reading public provider endpoints directly or from bundled fixture data, with no persistence beyond browser storage; **Phase 2 adds the Express and MongoDB back end**, which takes over ingestion, caching, provenance, accounts, workspaces and alerts. List which requirement groups are deferred to Phase 2. Put a short paragraph on this at the end of section 2.3 as well.

## 6. Appendix C — system models

- **C.1 System Architecture** — a figure placeholder written as a line beginning "Figure C-1 - system architecture - ..." followed by two or three sentences describing the browser, the Express API with its named services (auth, catalog, propagation, planning, ingestion, workspace, alerts), MongoDB, and the external providers.
- **C.2 Catalog, Target and Plan Structure** — a figure placeholder showing object, element set, watchlist, observation plan, window and log entry, with a worked example.
- **C.3 Document Model** — a three-column table (collection, main fields, relationships) covering: User, Session/RefreshToken, EmailToken, RoleRequest, SpaceObject, ElementSet, ObserverLocation, Watchlist, ObservationPlan, PassWindow, ObservationLog, GroundStation, StationBooking, TelemetryChannel, TelemetrySample, SpaceWeatherSample, Mission, Launch, AstronomyEvent, DataSource, ProvenanceRecord, CacheEntry, Workspace, Project, Dataset, SavedQuery, Note, Collaborator, ShareLink, AlertRule, AlertDelivery, Setting, AuditLog. Because this is MongoDB and not a relational database, say for each one whether it is **embedded** in its parent or **referenced**, and justify the choice in one clause.
- **C.4 Database Design Notes** — the embedding-versus-referencing rules; which collections are **append-only** (TelemetrySample, SpaceWeatherSample, ProvenanceRecord, AuditLog, AlertDelivery); which are **time-series collections**; which carry **TTL indexes** and with what retention; the compound and geospatial indexes; schema validation at the collection level as well as in the application; and how migrations are handled without a relational migration tool (versioned migration scripts committed to the repository).

## 7. Appendix D — prototype of forms and pages

Four three-column tables (page, purpose, main elements):

- **D.1 Public Pages** — landing, object catalog, object detail, launch and mission database, astronomy events calendar, space weather summary, shared workspace or report view, login, register, verify email, forgot and reset password.
- **D.2 User Pages** — dashboard, live tracker (2D map and 3D globe), look-up view, watchlists, observer locations, observation planner, pass detail, observation log, alerts, exports.
- **D.3 Researcher and Engineer Pages** — workspace list, project view, query builder, dataset snapshot view, notes, collaborators and sharing; element-set history and staleness diagnostics, decay and re-entry estimate, ground station configuration, station schedule, telemetry dashboard builder, anomaly thresholds.
- **D.4 Admin Pages** — users and roles, role-upgrade requests, catalog management, data sources and ingestion health, cache controls, missions, launches and events, global settings and thresholds, shared-content moderation, audit log, analytics.

## 8. Appendices E to K

- **E Scenarios** — four scenarios, each opening with "Actor: ... Goal: ..." and then a numbered walk-through. Per Sommerville, each must include the starting situation, the normal flow, what can go wrong, and the finishing state. Use: (1) a new observer registers, sets a location and plans an ISS pass; (2) a researcher builds a project, freezes a dataset snapshot and shares it with a collaborator; (3) an engineer configures a ground station, hits a scheduling conflict and reviews a telemetry anomaly; (4) an admin adds a data source and handles a provider outage that puts the system into degraded mode.
- **F Use Cases** — **F.1** a two-column list of 26 to 30 use cases, UC-01 upward, each with its actor. Then expand **four** of them in full form-based tables with rows: Actor, Goal, Preconditions, Main flow (numbered steps in one cell), Alternative flows (A1, A2, A3 ...), Postconditions. Expand these four: *Predict passes for a watchlist*, *Create and rank an observation plan*, *Create and share a research dataset snapshot*, *Ingest data from a provider and enter degraded mode*.
- **G Tabular Specification** — two condition/action tables. **G.1 Pass visibility and ranking decisions**: each row a condition (maximum elevation below the minimum; satellite in Earth's shadow; observer sky not dark enough; pass blocked by the horizon mask; two windows overlap for one observer; cloud cover above the threshold; element set stale; element set expired) with the exact action taken. **G.2 Data freshness and degraded mode**: each row a condition (source responds with valid data; source responds with data that fails validation; source times out; source returns a rate-limit error; cached data within TTL; cached data past TTL but within the degraded-mode limit; no cached data at all) with the exact action and what the user is shown.
- **H Assumptions, Dependencies and Risks** — H.1 assumptions, H.2 dependencies, H.3 a three-column risk table (risk, impact, mitigation) covering provider outage and rate limits, element-set accuracy and staleness, WebGL and performance on weak hardware, free-tier limits, MongoDB data growth from telemetry, scope overrun by a student team, and the risk of presenting an estimate as a measurement; H.4 the evaluation approach, tying back to A.11.
- **I Future Enhancements** — real decoded telemetry through a ground-station network, conjunction screening, a public read API with keys, institutional and team accounts, native mobile applications, machine-learned pass-success prediction from recorded observation logs, additional languages, offline sky charts, and integration with telescope control.
- **J Conclusion** — one dense paragraph: restate what SpaceNova is and name its defining characteristics (self-computed and testable orbital predictions, scored and ranked observation windows, provenance and freshness carried on every value, private citable research workspaces, and role-based access across five user classes), and state that its behaviour can be measured and defended through the validation in A.11.
- **K References** — the five or six compared systems with URLs; ISO/IEC/IEEE 29148:2018 and IEEE Std 830-1998; Sommerville, *Software Engineering*, Chapter 4; the SGP4 literature (Vallado et al., "Revisiting Spacetrack Report #3"); and the documentation for React, Express, MongoDB, Mongoose and satellite.js.

## 9. Non-functional requirements (section 6)

Ten subsections, every bullet carrying a number, percentage or other objective measure. Label each subsection with its Sommerville type where it is natural.

6.1 **Performance** (product) — 3D globe frame rate with a stated number of tracked objects; browser propagation time per object per step; pass prediction for a 10-object watchlist over 7 days within a stated time; API response percentiles; page load percentiles; concurrent user target.
6.2 **Security** (product) — bcrypt password hashing, httpOnly and Secure cookies, HTTPS in production, role and ownership checks on every protected route, server-side validation of all input, rate limiting on authentication and prediction endpoints, secrets in environment variables only and never in the browser or the repository, and provider API keys held only on the server.
6.3 **Usability** (product) — consistent navigation, errors never conveyed by colour alone, a first-run flow that sets the observer location, every numeric panel showing its source and data age, and tooltips explaining azimuth, elevation, magnitude and the quality score.
6.4 **Accessibility** (product) — contrast ratio, keyboard navigation for every non-visualization page, labelled form fields, status conveyed by text or icon as well as colour, a 2D fallback for the 3D globe, and a reduced-motion mode.
6.5 **Reliability and Availability** (product) — atomicity of a plan or snapshot write, degraded mode when a provider is unreachable, an availability target, and tested backup and restore.
6.6 **Scalability** (product) — new data sources, object types, event types and alert rules added through data rather than code changes; indexes on the fastest-growing collections; telemetry and cache retention limits; and a stated growth target for catalog size and stored samples.
6.7 **Maintainability** (organisational) — a clear layering of routes, controllers, services and data access; the propagation, visibility and scoring functions written as **pure functions covered by unit tests against reference values**; shared request and response schemas defined once; JSDoc on exported functions, since the codebase is JavaScript rather than TypeScript; ESLint and Prettier enforced in continuous integration; and GitHub with a protected main branch, pull-request review and automated checks.
6.8 **Compatibility** (product) — named browsers and versions, minimum screen width for the standard pages and for the visualization pages, and the WebGL 2 requirement with its stated fallback.
6.9 **Privacy and Data Provenance** (product and external) — minimum personal data stored; observer location treated as personal data, never shared without an explicit action, and never placed in a URL; a stated retention period for raw telemetry and cache data; account and data deletion; and the rule that **every displayed value carries its source and retrieval time, and no computed or estimated value is ever presented as a measurement**.
6.10 **External and Legal Requirements** (external) — compliance with each provider's terms of use and rate limits, the attribution and citation obligations that exports must carry, the Space-Track.org user agreement as a constraint on redistribution, and an explicit statement that SpaceNova is not certified for operational, navigational or safety-critical use.

## 10. Writing style and output format

- Formal engineering register: plain, precise, no marketing language, no filler. British spelling (organised, visualisation, licence as a noun). Prose paragraphs in sections 1 to 4 and the appendix narratives; tables and numbered requirements where the structure calls for them.
- Open section 1 (Preface) with what the system is and why, then an "Intended readers" list (development team, course instructor and graders, testers) and a "Conventions" list (the shall/should/may rule, the requirement identifier scheme such as SYS-PASS-3, the M/S/C priorities, and the note that default threshold values are initial estimates tuned by the validation in A.11).
- Figures are **placeholders**, written as a line beginning "Figure C-1 - " with a short description, followed by prose explaining what the figure shows. Do not attempt ASCII art.
- Target length: a complete document comparable to a 35 to 45 page submission. Do not abbreviate, do not write "and so on" in place of content, and do not collapse a table into a sentence. If the output is cut off, continue from exactly where it stopped when asked.
- **Deliverable**: produce a **Microsoft Word .docx file** using Heading 1 for the document title, Heading 2 for the numbered sections and appendix titles, Heading 3 for subsections, real Word tables for every table, and a Contents list after the Document History table. Fill the title page from the block below. If you cannot produce a .docx, output the entire document as Markdown with explicit heading levels and pipe tables so it can be converted.

## 11. Title page

Use these fields, leaving the bracketed ones for me to fill:

- Title: SOFTWARE REQUIREMENTS SPECIFICATION for SpaceNova
- Subtitle: Scalable Space-Data and Observation Planning Platform
- Version 1.0
- Prepared by: [[list of team members, each as "(ID) Full Name"]]
- Submitted to: [[Dr. name]]
- [[University name]] | [[Month Year]]

Then a Document History table with three rows (0.1 initial structure; 0.9 detailed requirements, propagation engine, models; 1.0 first complete draft), and a Contents list naming sections 1 to 6 followed by a single line listing appendices A to K.

Now write the complete document.

/**
 * Research workspaces, Phase 1 fixtures.
 *
 * The shape follows SRS section 2.5: Workspace -> Project -> Dataset /
 * SavedQuery / Note, with Collaborators and ShareLinks hanging off the project.
 * A dataset is an IMMUTABLE SNAPSHOT: it records the query or the uploaded
 * file, the sources, the retrieval time and a row count, and it is never
 * recomputed in place. Public share links were removed, so a workspace reaches
 * other people only through its invited collaborators.
 */

import { rng, slug } from '../lib/random.js';

const WORKSPACE_SEED = [
  [
    'Pass Prediction Accuracy',
    'Comparing predicted acquisition times against recorded observations to put a number on the element-set staleness penalty.',
    'mohammed-essam',
  ],
  [
    'Low Perigee Decay Survey',
    'Tracking perigee altitude against solar activity for objects below 350 km over a six-month window.',
    'tomas-lindqvist',
  ],
  [
    'Amateur Band Doppler Study',
    'Recording Doppler curves on the UHF amateur band to characterise receiver tuning strategies.',
    'hana-suzuki',
  ],
  [
    'Urban Sky Quality and Pass Yield',
    'Relating horizon obstruction masks and cloud forecasts to the fraction of predicted passes actually observed.',
    'ingrid-moen',
  ],
];

const PROJECT_SEED = [
  ['Baseline comparison', 'Reference run against a fixed set of twelve LEO payloads.'],
  ['Staleness sweep', 'The same objects re-run against element sets of increasing epoch age.'],
  ['Observer variance', 'Four observer locations at different latitudes and horizon masks.'],
  ['Write-up figures', 'Final selection of datasets and the figures drawn from them.'],
  ['Pilot run', 'A short pilot to settle the recording protocol before the main campaign.'],
];

const QUERY_SEED = [
  ['LEO payloads above 50 degrees inclination', 'catalog', '{"orbitClass":"LEO","type":"payload","inclinationMin":50}'],
  ['Visible passes, next 7 days, Cairo', 'passes', '{"locationId":"cairo","hours":168,"visibleOnly":true}'],
  ['Element sets with epoch older than 7 days', 'element-sets', '{"freshness":["stale","expired"]}'],
  ['Objects with perigee below 350 km', 'catalog', '{"perigeeMaxKm":350}'],
  ['Kp index above 5 in the last 30 days', 'space-weather', '{"metric":"kp","min":5,"days":30}'],
  ['Observation log outcomes by month', 'observations', '{"groupBy":"month"}'],
];

const NOTE_SEED = [
  [
    'Protocol for recording acquisition time',
    'Start the recorder sixty seconds before predicted AOS and log the first frame in which the beacon is above the noise floor. Use the station clock, not the laptop clock: the drift on the laptop was 1.8 s over the last session and that is the same order as the quantity being measured.',
  ],
  [
    'Why the staleness penalty is not linear',
    'Across the sweep, the error in acquisition time stays under two seconds for the first day after epoch and then grows faster than the epoch age. That matches the along-track error growing with the square of the time since epoch for a drag-dominated orbit, so the penalty in the score should probably be convex rather than the current piecewise constant.',
  ],
  [
    'Cloud forecast gaps',
    'Beyond seven days the provider returns nothing, so the score drops the cloud term and renormalises. Worth recording which windows were scored without it, because they are not comparable with the rest.',
  ],
  [
    'Horizon mask measurement',
    'Measured the mask with a clinometer app at ten-degree intervals from the rooftop. The building to the north-east blocks up to fourteen degrees, which removes roughly one pass in six from the usable set at this site.',
  ],
  [
    'Open question: magnitude estimate',
    'The magnitude model assumes a diffuse sphere. For the large flat-panel constellations the observed brightness swings by two magnitudes within a single pass, which the model cannot reproduce. Either exclude them or record the discrepancy as a known limitation.',
  ],
];

export function buildWorkspaces(users, objects, now = new Date()) {
  const workspaces = [];

  WORKSPACE_SEED.forEach(([name, description, ownerId], wi) => {
    const random = rng(`workspace-${name}`);
    const owner = users.find((u) => u.id === ownerId) ?? users[0];
    const created = new Date(now.getTime() - random.range(30, 300) * 86400000);
    const projectCount = random.int(2, 4);

    const projects = Array.from({ length: projectCount }, (_, pi) => {
      const [projectName, projectDescription] = PROJECT_SEED[(wi + pi) % PROJECT_SEED.length];
      const projectCreated = new Date(created.getTime() + random.range(1, 40) * 86400000);
      const projectRandom = rng(`project-${name}-${pi}`);

      const datasets = Array.from({ length: projectRandom.int(2, 4) }, (_, di) => {
        const [queryLabel, queryKind, queryJson] = QUERY_SEED[(pi + di) % QUERY_SEED.length];
        const frozen = new Date(projectCreated.getTime() + projectRandom.range(1, 30) * 86400000);
        return {
          id: slug(`${name}-${projectName}-ds-${di}`),
          name: `${queryLabel} (snapshot ${di + 1})`,
          queryLabel,
          queryKind,
          queryJson,
          rowCount: projectRandom.int(18, 4820),
          columns: projectRandom.int(5, 17),
          sizeBytes: projectRandom.int(4_200, 1_840_000),
          frozenAt: frozen.toISOString(),
          frozenBy: owner.name,
          immutable: true,
          checksum: `sha256:${Array.from({ length: 12 }, () => projectRandom.int(0, 15).toString(16)).join('')}`,
          // Provenance is recorded per source, which is what the citation block prints.
          provenance: [
            {
              source: 'Bundled fixture catalogue',
              endpoint: 'local://fixtures/objects',
              retrievedAt: frozen.toISOString(),
              licence: 'Fixture data, no redistribution restriction',
            },
            ...(queryKind === 'space-weather'
              ? [{
                  source: 'Space weather feed (fixture)',
                  endpoint: 'local://fixtures/space-weather',
                  retrievedAt: frozen.toISOString(),
                  licence: 'Public domain in production; fixture in Phase 1',
                }]
              : []),
            ...(queryKind === 'passes'
              ? [{
                  source: 'Computed by the SpaceNova propagation engine',
                  endpoint: 'engine://sgp4+visibility+score',
                  retrievedAt: frozen.toISOString(),
                  licence: 'Derived product. Thresholds recorded with the snapshot.',
                }]
              : []),
          ],
          thresholdsUsed: {
            minElevationDeg: 10,
            twilightThresholdDeg: -12,
            propagationHorizonDays: 10,
          },
        };
      });

      const notes = Array.from({ length: projectRandom.int(1, 3) }, (_, ni) => {
        const [title, body] = NOTE_SEED[(pi * 2 + ni) % NOTE_SEED.length];
        return {
          id: slug(`${name}-${projectName}-note-${ni}`),
          title,
          body,
          authorName: owner.name,
          datasetId: projectRandom.bool(0.6) ? datasets[0]?.id ?? null : null,
          createdAt: new Date(projectCreated.getTime() + projectRandom.range(2, 50) * 86400000).toISOString(),
          updatedAt: new Date(now.getTime() - projectRandom.range(1, 40) * 86400000).toISOString(),
        };
      });

      const savedQueries = QUERY_SEED.slice(0, projectRandom.int(2, 4)).map(
        ([queryLabel, queryKind, queryJson], qi) => ({
          id: slug(`${name}-${projectName}-q-${qi}`),
          label: queryLabel,
          kind: queryKind,
          json: queryJson,
          lastRunAt: new Date(now.getTime() - projectRandom.range(1, 400) * 3600000).toISOString(),
          lastRowCount: projectRandom.int(12, 3200),
        }),
      );

      return {
        id: slug(`${name}-${projectName}`),
        workspaceId: slug(name),
        name: projectName,
        description: projectDescription,
        createdAt: projectCreated.toISOString(),
        updatedAt: new Date(now.getTime() - projectRandom.range(1, 30) * 86400000).toISOString(),
        datasets,
        notes,
        savedQueries,
        objectIds: projectRandom
          .shuffle(objects.filter((o) => o.orbitClass === 'LEO').map((o) => o.id))
          .slice(0, projectRandom.int(4, 12)),
      };
    });

    const collaborators = random
      .shuffle(users.filter((u) => u.id !== owner.id && u.role !== 'guest'))
      .slice(0, random.int(1, 4))
      .map((u) => ({
        userId: u.id,
        name: u.name,
        email: u.email,
        access: random.pick(['read', 'read', 'edit']),
        invitedAt: new Date(created.getTime() + random.range(1, 60) * 86400000).toISOString(),
        acceptedAt: random.bool(0.75)
          ? new Date(created.getTime() + random.range(2, 70) * 86400000).toISOString()
          : null,
      }));

    workspaces.push({
      id: slug(name),
      name,
      description,
      ownerId: owner.id,
      ownerName: owner.name,
      createdAt: created.toISOString(),
      updatedAt: new Date(now.getTime() - random.range(1, 20) * 86400000).toISOString(),
      projects,
      collaborators,
      visibility: 'private',
      datasetCount: projects.reduce((n, p) => n + p.datasets.length, 0),
      noteCount: projects.reduce((n, p) => n + p.notes.length, 0),
    });
  });

  return workspaces;
}

/** The citation block an export carries, assembled from a dataset's provenance. */
export function citationFor(dataset, project, workspace, now = new Date()) {
  const lines = [
    `${workspace.ownerName} (${new Date(dataset.frozenAt).getUTCFullYear()}). "${dataset.name}".`,
    `Dataset snapshot from the project "${project.name}" in the SpaceNova workspace "${workspace.name}".`,
    `Frozen ${new Date(dataset.frozenAt).toISOString()}. ${dataset.rowCount} rows. Checksum ${dataset.checksum}.`,
    '',
    'Sources:',
    ...dataset.provenance.map(
      (p) => `  - ${p.source}. ${p.endpoint}. Retrieved ${new Date(p.retrievedAt).toISOString()}. ${p.licence}`,
    ),
    '',
    'Thresholds applied at snapshot time:',
    ...Object.entries(dataset.thresholdsUsed).map(([k, v]) => `  - ${k}: ${v}`),
    '',
    `Exported ${now.toISOString()} from SpaceNova.`,
  ];
  return lines.join('\n');
}

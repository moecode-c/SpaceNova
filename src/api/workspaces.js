/**
 * Research workspaces (SRS module 11).
 *
 * Public read-only share links were removed, so a workspace is private to its
 * owner and the collaborators invited into it. Datasets are either frozen from
 * a query or uploaded as a file; both are immutable once recorded.
 */

import { db } from '../mock/db.js';
import { citationFor } from '../mock/research.js';
import { call, envelope, ApiError } from './client.js';
import { slug } from '../lib/random.js';

function findWorkspace(workspaceId) {
  const workspace = db().workspaces.find((w) => w.id === workspaceId);
  if (!workspace) throw new ApiError('Workspace not found.', { status: 404, code: 'not_found' });
  return workspace;
}

function findProject(workspaceId, projectId) {
  const workspace = findWorkspace(workspaceId);
  const project = workspace.projects.find((p) => p.id === projectId);
  if (!project) throw new ApiError('Project not found.', { status: 404, code: 'not_found' });
  return { workspace, project };
}

export const workspaces = {
  list() {
    return call(() => {
      const rows = db().workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        ownerId: w.ownerId,
        ownerName: w.ownerName,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        visibility: w.visibility,
        projectCount: w.projects.length,
        datasetCount: w.datasetCount,
        noteCount: w.noteCount,
        collaboratorCount: w.collaborators.length,
      }));
      return envelope(rows, { source: 'fixture-research', sourceLabel: 'Research workspaces' });
    }, { scale: 0.5 });
  },

  get(workspaceId) {
    return call(() => envelope(findWorkspace(workspaceId), {
      source: 'fixture-research',
      sourceLabel: 'Research workspaces',
    }));
  },

  create({ name, description }) {
    return call(() => {
      if (!name || name.trim().length < 3) {
        throw new ApiError('Give the workspace a name.', {
          status: 422, code: 'validation', fields: { name: 'Give the workspace a name.' },
        });
      }
      const store = db();
      const workspace = {
        id: slug(`${name}-${Date.now()}`),
        name: name.trim(),
        description: description?.trim() ?? '',
        ownerId: store.users[0].id,
        ownerName: store.users[0].name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projects: [],
        collaborators: [],
        visibility: 'private',
        datasetCount: 0,
        noteCount: 0,
      };
      store.workspaces.unshift(workspace);
      return envelope(workspace, { source: 'fixture-research' });
    });
  },

  remove(workspaceId) {
    return call(() => {
      const store = db();
      const index = store.workspaces.findIndex((w) => w.id === workspaceId);
      if (index < 0) throw new ApiError('Workspace not found.', { status: 404, code: 'not_found' });
      store.workspaces.splice(index, 1);
      return envelope({ removed: true }, { source: 'fixture-research' });
    });
  },

  project(workspaceId, projectId) {
    return call(() => {
      const { workspace, project } = findProject(workspaceId, projectId);
      return envelope(
        { workspace: { id: workspace.id, name: workspace.name, ownerName: workspace.ownerName }, project },
        { source: 'fixture-research' },
      );
    });
  },

  createProject(workspaceId, { name, description }) {
    return call(() => {
      const workspace = findWorkspace(workspaceId);
      if (!name || name.trim().length < 2) {
        throw new ApiError('Give the project a name.', {
          status: 422, code: 'validation', fields: { name: 'Give the project a name.' },
        });
      }
      const project = {
        id: slug(`${workspace.name}-${name}-${Date.now()}`),
        workspaceId: workspace.id,
        name: name.trim(),
        description: description?.trim() ?? '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        datasets: [],
        notes: [],
        savedQueries: [],
        objectIds: [],
      };
      workspace.projects.push(project);
      workspace.updatedAt = new Date().toISOString();
      return envelope(project, { source: 'fixture-research' });
    });
  },

  /**
   * Freeze a query result as an immutable dataset snapshot.
   *
   * The snapshot records the query, the row count, the sources with their
   * retrieval times and licences, and the thresholds in force at the moment it
   * was taken. It is never recomputed in place: a later run creates a new
   * snapshot (SRS module 11).
   */
  freezeDataset(workspaceId, projectId, { queryLabel, queryKind, queryJson, rowCount }) {
    return call(() => {
      const store = db();
      const { workspace, project } = findProject(workspaceId, projectId);
      const frozenAt = new Date();
      const dataset = {
        id: slug(`${project.name}-snapshot-${Date.now()}`),
        name: `${queryLabel} (snapshot ${project.datasets.length + 1})`,
        queryLabel,
        queryKind,
        queryJson,
        rowCount: rowCount ?? 0,
        columns: 0,
        sizeBytes: 0,
        frozenAt: frozenAt.toISOString(),
        frozenBy: workspace.ownerName,
        immutable: true,
        checksum: `sha256:${Math.random().toString(16).slice(2, 14)}`,
        provenance: [
          {
            source: 'Bundled fixture catalogue',
            endpoint: 'local://fixtures/objects',
            retrievedAt: store.builtAt.toISOString(),
            licence: 'Fixture data, no redistribution restriction',
          },
          {
            source: 'Computed by the SpaceNova propagation engine',
            endpoint: 'engine://sgp4+visibility+score',
            retrievedAt: frozenAt.toISOString(),
            licence: 'Derived product. Thresholds recorded with the snapshot.',
          },
        ],
        thresholdsUsed: {
          minElevationDeg: store.settings.minElevationDeg,
          twilightThresholdDeg: store.settings.twilightThresholdDeg,
          propagationHorizonDays: store.settings.propagationHorizonDays,
        },
      };
      project.datasets.unshift(dataset);
      workspace.datasetCount += 1;
      workspace.updatedAt = frozenAt.toISOString();
      return envelope(dataset, { source: 'fixture-research' });
    });
  },

  /**
   * Record an uploaded file as an immutable dataset.
   *
   * The file is parsed in the browser, so what arrives here is already rows,
   * fields and a digest. It is frozen on arrival for the same reason a query
   * snapshot is: the point of a dataset is that the analysis it feeds can be
   * reproduced, and a file that can be edited afterwards cannot promise that.
   *
   * Provenance names the file, who uploaded it and when, rather than claiming
   * the platform retrieved it from a source.
   */
  uploadDataset(workspaceId, projectId, payload) {
    return call(() => {
      const store = db();
      const { workspace, project } = findProject(workspaceId, projectId);
      const {
        name, filename, format, delimiterLabel, fields, rows, rowCount,
        sizeBytes, digest, truncated, warnings, notes,
      } = payload;

      const fieldErrors = {};
      if (!name || name.trim().length < 3) fieldErrors.name = 'Give the dataset a name.';
      if (!fields?.length) fieldErrors.file = 'The file produced no columns.';
      if (!rowCount) fieldErrors.file = 'The file produced no rows.';
      if (Object.keys(fieldErrors).length) {
        throw new ApiError('Check the details below.', {
          status: 422, code: 'validation', fields: fieldErrors,
        });
      }

      const frozenAt = new Date();
      const dataset = {
        id: slug(`${project.name}-upload-${Date.now()}`),
        name: name.trim(),
        origin: 'upload',
        filename,
        fileFormat: format,
        delimiterLabel: delimiterLabel ?? null,
        queryLabel: `Uploaded file ${filename}`,
        queryKind: 'upload',
        queryJson: JSON.stringify({ filename, format, delimiter: delimiterLabel ?? null }),
        rowCount,
        rowsStored: rows.length,
        rowsTruncated: !!truncated,
        columns: fields.length,
        fields,
        rows,
        sizeBytes: sizeBytes ?? 0,
        frozenAt: frozenAt.toISOString(),
        frozenBy: workspace.ownerName,
        immutable: true,
        checksum: digest?.label ?? 'not computed',
        checksumAlgorithm: digest?.algorithm ?? null,
        parseWarnings: warnings ?? [],
        notes: notes?.trim() ?? '',
        provenance: [
          {
            source: `Uploaded file: ${filename}`,
            endpoint: 'upload://local-file',
            retrievedAt: frozenAt.toISOString(),
            licence:
              'Supplied by the uploader. SpaceNova records the file but makes no claim ' +
              'about its licence or its accuracy.',
          },
        ],
        thresholdsUsed: {
          minElevationDeg: store.settings.minElevationDeg,
          twilightThresholdDeg: store.settings.twilightThresholdDeg,
          propagationHorizonDays: store.settings.propagationHorizonDays,
        },
      };

      project.datasets.unshift(dataset);
      project.updatedAt = frozenAt.toISOString();
      workspace.datasetCount += 1;
      workspace.updatedAt = frozenAt.toISOString();
      return envelope(dataset, { source: 'fixture-research' });
    });
  },

  dataset(workspaceId, projectId, datasetId) {
    return call(() => {
      const { workspace, project } = findProject(workspaceId, projectId);
      const dataset = project.datasets.find((d) => d.id === datasetId);
      if (!dataset) throw new ApiError('Dataset not found.', { status: 404, code: 'not_found' });
      return envelope(
        {
          workspace: { id: workspace.id, name: workspace.name, ownerName: workspace.ownerName },
          project: { id: project.id, name: project.name },
          dataset,
          citation: citationFor(dataset, project, workspace),
        },
        { source: 'fixture-research' },
      );
    });
  },

  addNote(workspaceId, projectId, { title, body, datasetId }) {
    return call(() => {
      const { workspace, project } = findProject(workspaceId, projectId);
      const fields = {};
      if (!title || title.trim().length < 3) fields.title = 'Give the note a title.';
      if (!body || body.trim().length < 10) fields.body = 'Write at least a sentence.';
      if (Object.keys(fields).length) {
        throw new ApiError('Check the details below.', { status: 422, code: 'validation', fields });
      }
      const note = {
        id: slug(`${project.name}-note-${Date.now()}`),
        title: title.trim(),
        body: body.trim(),
        authorName: workspace.ownerName,
        datasetId: datasetId ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      project.notes.unshift(note);
      workspace.noteCount += 1;
      return envelope(note, { source: 'fixture-research' });
    });
  },

  removeNote(workspaceId, projectId, noteId) {
    return call(() => {
      const { workspace, project } = findProject(workspaceId, projectId);
      const index = project.notes.findIndex((n) => n.id === noteId);
      if (index < 0) throw new ApiError('Note not found.', { status: 404, code: 'not_found' });
      project.notes.splice(index, 1);
      workspace.noteCount = Math.max(0, workspace.noteCount - 1);
      return envelope({ removed: true }, { source: 'fixture-research' });
    });
  },

  invite(workspaceId, { email, access }) {
    return call(() => {
      const store = db();
      const workspace = findWorkspace(workspaceId);
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new ApiError('Enter a valid email address.', {
          status: 422, code: 'validation', fields: { email: 'Enter a valid email address.' },
        });
      }
      if (workspace.collaborators.some((c) => c.email.toLowerCase() === email.toLowerCase())) {
        throw new ApiError('That person is already a collaborator.', { status: 409, code: 'conflict' });
      }
      const user = store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      const collaborator = {
        userId: user?.id ?? `pending-${Date.now()}`,
        name: user?.name ?? email.split('@')[0],
        email: email.toLowerCase(),
        access: access === 'edit' ? 'edit' : 'read',
        invitedAt: new Date().toISOString(),
        acceptedAt: null,
      };
      workspace.collaborators.push(collaborator);
      return envelope(collaborator, { source: 'fixture-research' });
    });
  },

  updateCollaborator(workspaceId, userId, patch) {
    return call(() => {
      const workspace = findWorkspace(workspaceId);
      const collaborator = workspace.collaborators.find((c) => c.userId === userId);
      if (!collaborator) throw new ApiError('Collaborator not found.', { status: 404, code: 'not_found' });
      Object.assign(collaborator, patch);
      return envelope(collaborator, { source: 'fixture-research' });
    }, { scale: 0.4 });
  },

  removeCollaborator(workspaceId, userId) {
    return call(() => {
      const workspace = findWorkspace(workspaceId);
      const index = workspace.collaborators.findIndex((c) => c.userId === userId);
      if (index < 0) throw new ApiError('Collaborator not found.', { status: 404, code: 'not_found' });
      workspace.collaborators.splice(index, 1);
      return envelope({ removed: true }, { source: 'fixture-research' });
    }, { scale: 0.4 });
  },
};

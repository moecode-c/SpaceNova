import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Camera, Database, FileSpreadsheet, FileStack, FileUp,
  NotebookPen, Play, Plus, Satellite, Trash2, Upload,
} from 'lucide-react';
import { Grid, KeyValue, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, Section, StatTile } from '../../components/ui/panel.jsx';
import { Breadcrumbs, Tabs } from '../../components/ui/nav.jsx';
import { DataTable } from '../../components/ui/table.jsx';
import { Field, FormError, Input, Select, Textarea } from '../../components/ui/form.jsx';
import { Badge, Button, IconButton, Tag } from '../../components/ui/primitives.jsx';
import { Modal } from '../../components/ui/overlay.jsx';
import { EmptyState, ErrorState, InlineNote, LoadingState, useToast } from '../../components/ui/feedback.jsx';
import { SourceTag } from '../../components/data/source.jsx';
import { useApi, useAction } from '../../hooks/useApi.js';
import { workspaces as workspacesApi } from '../../api/index.js';
import { age, bytes, dateTime, num } from '../../lib/format.js';
import { digestOf, parseTable, ROW_LIMIT } from '../../lib/parse-table.js';

export default function ProjectDetail() {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('datasets');
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');

  /* Upload. `parsed` holds the file's contents until the researcher confirms. */
  const fileInput = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');

  const project = useApi(() => workspacesApi.project(workspaceId, projectId), [workspaceId, projectId]);
  const data = project.data;

  const freeze = useAction(
    () => {
      const query = data.project.savedQueries.find((q) => q.id === selectedQuery);
      return workspacesApi.freezeDataset(workspaceId, projectId, {
        queryLabel: query?.label ?? 'Ad hoc query',
        queryKind: query?.kind ?? 'catalog',
        queryJson: query?.json ?? '{}',
        rowCount: query?.lastRowCount ?? 0,
      });
    },
    {
      onSuccess: () => {
        setFreezeOpen(false);
        toast.success('Snapshot frozen', 'It records its sources, retrieval times and thresholds.');
        project.refetch();
      },
    },
  );

  /**
   * Read, parse and stage a dropped file.
   *
   * The parse happens here rather than on submit so the researcher sees the
   * columns, the types and any warnings before anything is recorded. Nothing
   * reaches the workspace until they confirm.
   */
  const takeFile = async (file) => {
    if (!file) return;
    setParseError(null);
    setParsed(null);
    setParsing(true);
    try {
      if (file.size > 25 * 1024 * 1024) {
        throw new Error('The file is larger than 25 MB. Sample it or split it first.');
      }
      const text = await file.text();
      const table = parseTable(text, file.name);
      const digest = await digestOf(text);
      setParsed({ ...table, filename: file.name, sizeBytes: file.size, digest });
      setUploadName(file.name.replace(/\.[^.]+$/, ''));
    } catch (error) {
      setParseError(error.message);
    } finally {
      setParsing(false);
    }
  };

  const closeUpload = () => {
    setUploadOpen(false);
    setParsed(null);
    setParseError(null);
  };

  const upload = useAction(
    () =>
      workspacesApi.uploadDataset(workspaceId, projectId, {
        name: uploadName,
        notes: uploadNotes,
        filename: parsed.filename,
        format: parsed.format,
        delimiterLabel: parsed.delimiterLabel,
        fields: parsed.fields,
        rows: parsed.rows,
        rowCount: parsed.rowCount,
        truncated: parsed.truncated,
        warnings: parsed.warnings,
        sizeBytes: parsed.sizeBytes,
        digest: parsed.digest,
      }),
    {
      onSuccess: (dataset) => {
        setUploadOpen(false);
        setParsed(null);
        setUploadName('');
        setUploadNotes('');
        toast.success(
          'Dataset recorded',
          `${num(dataset.rowCount)} rows, frozen on arrival with the file's digest.`,
        );
        project.refetch();
        navigate(`/app/research/${workspaceId}/${projectId}/dataset/${dataset.id}`);
      },
      onError: (error) => toast.error('Could not record the dataset', error.message),
    },
  );

  const addNote = useAction(
    () => workspacesApi.addNote(workspaceId, projectId, { title: noteTitle, body: noteBody }),
    {
      onSuccess: () => {
        setNoteOpen(false);
        setNoteTitle('');
        setNoteBody('');
        toast.success('Note added');
        project.refetch();
      },
    },
  );

  const removeNote = useAction((noteId) => workspacesApi.removeNote(workspaceId, projectId, noteId), {
    onSuccess: () => {
      toast.success('Note removed');
      project.refetch();
    },
  });

  if (project.loading && !data) return <LoadingState label="Loading project" />;
  if (project.error) return <ErrorState error={project.error} onRetry={project.reload} />;
  if (!data) return null;

  const { workspace, project: row } = data;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Database}
        title={row.name}
        breadcrumb={
          <Breadcrumbs
            items={[
              { label: 'Workspaces', to: '/app/research' },
              { label: workspace.name, to: `/app/research/${workspaceId}` },
              { label: row.name },
            ]}
          />
        }
        description={row.description}
        meta={
          <>
            <Tag mono={false}>{workspace.ownerName}</Tag>
            <Tag mono={false}>created {age(row.createdAt)}</Tag>
            {project.meta && <SourceTag meta={project.meta} />}
          </>
        }
        actions={
          <>
            <Button size="sm" variant="ghost" icon={NotebookPen} onClick={() => setNoteOpen(true)}>
              Add a note
            </Button>
            <Button size="sm" variant="secondary" icon={Camera} onClick={() => setFreezeOpen(true)}>
              Freeze a query
            </Button>
            <Button size="sm" variant="primary" icon={Upload} onClick={() => setUploadOpen(true)}>
              Upload a dataset
            </Button>
          </>
        }
      />

      <Grid cols={4}>
        <StatTile label="Dataset snapshots" value={num(row.datasets.length)} icon={FileStack} />
        <StatTile label="Notes" value={num(row.notes.length)} icon={NotebookPen} />
        <StatTile label="Saved queries" value={num(row.savedQueries.length)} icon={Play} />
        <StatTile
          label="Objects referenced"
          value={num(row.objectIds.length)}
          icon={Satellite}
          hint="Across the queries in this project"
        />
      </Grid>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'datasets', label: 'Snapshots', icon: FileStack, count: row.datasets.length },
          { value: 'queries', label: 'Saved queries', icon: Play, count: row.savedQueries.length },
          { value: 'notes', label: 'Notes', icon: NotebookPen, count: row.notes.length },
        ]}
      />

      {tab === 'datasets' && (
        <Panel>
          <DataTable
            rowKey={(d) => d.id}
            onRowClick={(d) => navigate(`/app/research/${workspaceId}/${projectId}/dataset/${d.id}`)}
            columns={[
              {
                key: 'name',
                header: 'Snapshot',
                nowrap: false,
                render: (d) => (
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{d.name}</p>
                    <p className="truncate text-2xs text-ink-faint">{d.queryLabel}</p>
                  </div>
                ),
              },
              {
                key: 'queryKind',
                header: 'Source',
                hideBelow: 'md',
                render: (d) =>
                  d.origin === 'upload' ? (
                    <Badge tone="info" size="sm" icon={FileSpreadsheet}>
                      {d.fileFormat?.toUpperCase() ?? 'file'}
                    </Badge>
                  ) : (
                    <Tag>{d.queryKind}</Tag>
                  ),
              },
              { key: 'rowCount', header: 'Rows', align: 'right', mono: true, render: (d) => num(d.rowCount) },
              { key: 'columns', header: 'Columns', align: 'right', mono: true, hideBelow: 'lg' },
              { key: 'sizeBytes', header: 'Size', align: 'right', mono: true, hideBelow: 'lg', render: (d) => bytes(d.sizeBytes) },
              { key: 'frozenAt', header: 'Frozen (UTC)', mono: true, render: (d) => dateTime(d.frozenAt, true) },
              {
                key: 'immutable',
                header: 'State',
                render: () => (
                  <Badge tone="good" size="sm">
                    Immutable
                  </Badge>
                ),
              },
              {
                key: 'open',
                header: '',
                align: 'right',
                render: () => <ArrowRight size={13} className="text-ink-faint" aria-hidden />,
              },
            ]}
            rows={row.datasets}
            empty={
              <EmptyState
                icon={FileStack}
                title="No datasets yet"
                description="Upload a CSV or JSON file, or freeze a saved query. Either way the dataset is immutable from the moment it is recorded, so a figure you cite stays traceable."
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button size="sm" variant="primary" icon={Upload} onClick={() => setUploadOpen(true)}>
                      Upload a dataset
                    </Button>
                    <Button size="sm" variant="secondary" icon={Camera} onClick={() => setFreezeOpen(true)}>
                      Freeze a query
                    </Button>
                  </div>
                }
              />
            }
          />
        </Panel>
      )}

      {tab === 'queries' && (
        <Panel>
          <PanelHeader
            title="Saved queries"
            subtitle="A query is a question. Freezing it turns the answer into a snapshot that can be cited."
            icon={Play}
          />
          <DataTable
            rowKey={(q) => q.id}
            columns={[
              { key: 'label', header: 'Query', nowrap: false },
              { key: 'kind', header: 'Against', render: (q) => <Tag>{q.kind}</Tag> },
              {
                key: 'json',
                header: 'Parameters',
                nowrap: false,
                hideBelow: 'lg',
                render: (q) => <code className="font-code text-2xs text-ink-faint">{q.json}</code>,
              },
              { key: 'lastRowCount', header: 'Last rows', align: 'right', mono: true, render: (q) => num(q.lastRowCount) },
              { key: 'lastRunAt', header: 'Last run', mono: true, hideBelow: 'md', render: (q) => age(q.lastRunAt) },
              {
                key: 'freeze',
                header: '',
                align: 'right',
                render: (q) => (
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={Camera}
                    onClick={() => {
                      setSelectedQuery(q.id);
                      setFreezeOpen(true);
                    }}
                  >
                    Freeze
                  </Button>
                ),
              },
            ]}
            rows={row.savedQueries}
            empty={
              <EmptyState
                compact
                icon={Play}
                title="No saved queries"
                description="Queries saved from the catalogue and planner appear here."
              />
            }
          />
        </Panel>
      )}

      {tab === 'notes' && (
        <div className="space-y-3">
          {row.notes.length === 0 ? (
            <Panel>
              <EmptyState
                icon={NotebookPen}
                title="No notes"
                description="Notes are where the reasoning lives: why a number looks the way it does, and what you are still unsure about."
                action={
                  <Button size="sm" variant="primary" icon={Plus} onClick={() => setNoteOpen(true)}>
                    Add the first note
                  </Button>
                }
              />
            </Panel>
          ) : (
            row.notes.map((note) => (
              <Panel key={note.id}>
                <PanelHeader
                  title={note.title}
                  subtitle={`${note.authorName} · ${dateTime(note.createdAt)}`}
                  actions={
                    <IconButton
                      icon={Trash2}
                      label="Remove note"
                      size="sm"
                      onClick={() => removeNote.run(note.id)}
                    />
                  }
                />
                <PanelBody>
                  <p className="whitespace-pre-line text-xs leading-relaxed text-ink-dim">{note.body}</p>
                </PanelBody>
                {note.datasetId && (
                  <PanelFooter>
                    <Link
                      to={`/app/research/${workspaceId}/${projectId}/dataset/${note.datasetId}`}
                      className="link inline-flex items-center gap-1 text-2xs"
                    >
                      References a dataset snapshot
                      <ArrowRight size={11} aria-hidden />
                    </Link>
                  </PanelFooter>
                )}
              </Panel>
            ))
          )}
        </div>
      )}

      <Section title="Why snapshots are immutable">
        <Panel>
          <PanelBody className="space-y-2.5">
            <InlineNote>
              Element sets are replaced several times a day and the catalogue changes underneath
              you. A query re-run next month answers a different question from the one you asked.
            </InlineNote>
            <InlineNote>
              A snapshot therefore records the query, the rows, a checksum, every source with its
              retrieval time and licence, and the thresholds in force. Freezing again creates a new
              snapshot rather than overwriting the old one.
            </InlineNote>
          </PanelBody>
        </Panel>
      </Section>

      {/* ------------------------------------------------------ upload a file */}
      <Modal
        open={uploadOpen}
        onClose={closeUpload}
        title="Upload a dataset"
        description="A CSV, TSV or JSON file becomes an immutable dataset in this project. The file is read in this browser, and nothing is recorded until you confirm."
        size="lg"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={closeUpload}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={FileUp}
              loading={upload.pending}
              disabled={!parsed}
              onClick={() => upload.run()}
            >
              Record {parsed ? `${num(parsed.rowCount)} rows` : 'dataset'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* The drop target. A hidden file input sits behind it so the
              keyboard and the system file picker both work. */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              takeFile(e.dataTransfer.files?.[0]);
            }}
            className={
              dragging
                ? 'rounded-md border border-dashed border-primary bg-primary-soft/25 p-6 text-center transition-colors'
                : 'rounded-md border border-dashed border-line-strong p-6 text-center transition-colors'
            }
          >
            <FileUp size={20} className="mx-auto mb-2 text-ink-faint" aria-hidden />
            <p className="text-xs text-ink-dim">
              Drop a file here, or{' '}
              <button type="button" className="link" onClick={() => fileInput.current?.click()}>
                choose one
              </button>
              .
            </p>
            <p className="mt-1 text-2xs text-ink-faint">
              CSV, TSV or JSON, up to 25 MB. Commas, tabs, semicolons and pipes are all detected.
            </p>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.tsv,.txt,.json,text/csv,text/tab-separated-values,application/json"
              className="hidden"
              onChange={(e) => {
                takeFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>

          {parsing && <LoadingState compact label="Reading the file" />}

          {parseError && (
            <div className="flex items-start gap-2 rounded-md border border-bad/30 bg-bad-soft/40 px-3 py-2.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-bad" aria-hidden />
              <div>
                <p className="text-xs text-ink">The file could not be read.</p>
                <p className="mt-0.5 text-2xs leading-relaxed text-ink-faint">{parseError}</p>
              </div>
            </div>
          )}

          {parsed && (
            <>
              <KeyValue
                columns={2}
                rows={[
                  { label: 'File', value: parsed.filename, mono: false },
                  {
                    label: 'Format',
                    value: parsed.delimiterLabel
                      ? `${parsed.format.toUpperCase()}, ${parsed.delimiterLabel} separated`
                      : parsed.format.toUpperCase(),
                    mono: false,
                  },
                  { label: 'Rows', value: num(parsed.rowCount) },
                  { label: 'Columns', value: num(parsed.fields.length) },
                  { label: 'Size', value: bytes(parsed.sizeBytes) },
                  { label: 'Digest', value: parsed.digest.label },
                ]}
              />

              {parsed.warnings.length > 0 && (
                <div className="space-y-1.5">
                  {parsed.warnings.map((warning) => (
                    <InlineNote key={warning} icon={AlertTriangle}>
                      {warning}
                    </InlineNote>
                  ))}
                </div>
              )}

              <Section
                title="Columns"
                description="Types are inferred from the values and recorded with the dataset."
              >
                <div className="panel-inset max-h-44 overflow-y-auto p-2">
                  <ul className="space-y-1">
                    {parsed.fields.map((field) => (
                      <li
                        key={field.name}
                        className="flex items-center justify-between gap-3 border-b border-line/50 px-1 py-1 last:border-0"
                      >
                        <span className="truncate font-mono text-2xs text-ink-dim">{field.name}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          {field.nullCount > 0 && (
                            <span className="text-2xs text-ink-faint">{num(field.nullCount)} blank</span>
                          )}
                          <Tag>{field.type}</Tag>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Section>

              <Section
                title="First rows"
                description="A check that the columns line up before anything is recorded."
              >
                <div className="panel-inset overflow-x-auto">
                  <table className="w-full text-2xs">
                    <thead>
                      <tr className="border-b border-line">
                        {parsed.fields.slice(0, 8).map((field) => (
                          <th
                            key={field.name}
                            className="whitespace-nowrap px-2.5 py-1.5 text-left font-medium text-ink-faint"
                          >
                            {field.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-line/50 last:border-0">
                          {parsed.fields.slice(0, 8).map((field) => (
                            <td
                              key={field.name}
                              className="tnum max-w-[12rem] truncate px-2.5 py-1.5 font-mono text-ink-dim"
                            >
                              {row[field.name] === null ? '' : String(row[field.name])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsed.fields.length > 8 && (
                  <InlineNote>
                    {num(parsed.fields.length - 8)} further columns are not shown here. All of them
                    are recorded.
                  </InlineNote>
                )}
              </Section>

              <Field label="Dataset name" htmlFor="uploadName" error={upload.fieldErrors?.name} required>
                <Input
                  id="uploadName"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="Acquisition residuals, March campaign"
                />
              </Field>
              <Field
                label="Notes"
                htmlFor="uploadNotes"
                hint="Where the file came from, and anything a reader would need to interpret it."
              >
                <Textarea
                  id="uploadNotes"
                  rows={2}
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                />
              </Field>

              <InlineNote>
                The dataset is frozen the moment it is recorded, exactly as a query snapshot is. Its
                provenance names this file, you as the uploader and the time, and makes no claim
                about the licence or the accuracy of the contents.
                {parsed.truncated
                  ? ` The recorded row count is the full ${num(parsed.rowCount)}; the first ${num(ROW_LIMIT)} rows are stored.`
                  : ''}
              </InlineNote>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={freezeOpen}
        onClose={() => setFreezeOpen(false)}
        title="Freeze a dataset snapshot"
        description="The result is stored as it is now, with its provenance and the thresholds that produced it."
        size="sm"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setFreezeOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" icon={Camera} loading={freeze.pending} onClick={() => freeze.run()}>
              Freeze snapshot
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {freeze.error && <FormError error={freeze.error} />}
          <Field label="Query to freeze" htmlFor="freezeQuery">
            <Select id="freezeQuery" value={selectedQuery} onChange={(e) => setSelectedQuery(e.target.value)}>
              <option value="">Ad hoc query</option>
              {row.savedQueries.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
            </Select>
          </Field>
          <KeyValue
            dense
            rows={[
              { label: 'Recorded with the snapshot', value: 'query, rows, checksum', mono: false },
              { label: 'Sources', value: 'endpoint, retrieval time, licence', mono: false },
              { label: 'Thresholds', value: 'elevation, twilight, horizon', mono: false },
            ]}
          />
        </div>
      </Modal>

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Add a note"
        size="md"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" loading={addNote.pending} onClick={() => addNote.run()}>
              Save note
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {addNote.error && addNote.error.code !== 'validation' && <FormError error={addNote.error} />}
          <Field label="Title" htmlFor="noteTitle" error={addNote.fieldErrors?.title} required>
            <Input id="noteTitle" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
          </Field>
          <Field
            label="Note"
            htmlFor="noteBody"
            error={addNote.fieldErrors?.body}
            hint="What you observed, what it means, and what you are still unsure about."
            required
          >
            <Textarea id="noteBody" rows={8} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

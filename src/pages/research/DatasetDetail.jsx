import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Copy, Download, FileSpreadsheet, FileStack, Fingerprint, Lock, Quote,
  SlidersHorizontal,
} from 'lucide-react';
import { Grid, KeyValue, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, Section, StatTile } from '../../components/ui/panel.jsx';
import { Breadcrumbs } from '../../components/ui/nav.jsx';
import { Badge, Button, Tag } from '../../components/ui/primitives.jsx';
import { Banner, ErrorState, InlineNote, LoadingState, useToast } from '../../components/ui/feedback.jsx';
import { SourceTag } from '../../components/data/source.jsx';
import { useApi } from '../../hooks/useApi.js';
import { workspaces as workspacesApi } from '../../api/index.js';
import { bytes, dateTime, num } from '../../lib/format.js';
import { downloadCsv, downloadJson, fileSlug } from '../../lib/download.js';

export default function DatasetDetail() {
  const { workspaceId, projectId, datasetId } = useParams();
  const toast = useToast();

  const [rowsShown, setRowsShown] = useState(100);
  const [allColumns, setAllColumns] = useState(false);

  const { data, meta, loading, error, reload } = useApi(
    () => workspacesApi.dataset(workspaceId, projectId, datasetId),
    [workspaceId, projectId, datasetId],
  );

  if (loading && !data) return <LoadingState label="Loading snapshot" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const { workspace, project, dataset, citation } = data;

  /*
   * An uploaded dataset stores its rows, so they can be shown and exported
   * for real. A query snapshot stores the query instead, and says so.
   */
  const hasRows = Array.isArray(dataset.rows) && dataset.rows.length > 0;
  const fields = dataset.fields ?? [];
  const visibleColumns = allColumns ? fields : fields.slice(0, 10);

  const exportCsv = () => {
    if (!hasRows) {
      toast.error(
        'Nothing to write',
        'This snapshot records a query rather than a copy of its rows.',
      );
      return;
    }
    const count = downloadCsv(
      `${fileSlug(dataset.name)}.csv`,
      dataset.rows,
      dataset.fields.map((f) => ({ key: f.name, header: f.name })),
      citation.split('\n'),
    );
    toast.success('Dataset exported', `${num(count)} rows written, with the citation block above them.`);
  };

  const exportJson = () => {
    if (!hasRows) {
      toast.error(
        'Nothing to write',
        'This snapshot records a query rather than a copy of its rows.',
      );
      return;
    }
    downloadJson(`${fileSlug(dataset.name)}.json`, {
      dataset: {
        name: dataset.name,
        origin: dataset.origin ?? 'query',
        rowCount: dataset.rowCount,
        rowsStored: dataset.rows.length,
        checksum: dataset.checksum,
        frozenAt: dataset.frozenAt,
        frozenBy: dataset.frozenBy,
      },
      citation,
      provenance: dataset.provenance,
      thresholdsUsed: dataset.thresholdsUsed,
      fields: dataset.fields,
      rows: dataset.rows,
    });
    toast.success('Dataset exported', 'JSON, with the provenance and citation alongside the rows.');
  };

  const copyCitation = async () => {
    try {
      await navigator.clipboard.writeText(citation);
      toast.success('Citation copied', 'Paste it straight into your write-up.');
    } catch {
      toast.error('Could not copy', 'The browser refused clipboard access.');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={FileStack}
        title={dataset.name}
        breadcrumb={
          <Breadcrumbs
            items={[
              { label: 'Workspaces', to: '/app/research' },
              { label: workspace.name, to: `/app/research/${workspaceId}` },
              { label: project.name, to: `/app/research/${workspaceId}/${projectId}` },
              { label: 'Snapshot' },
            ]}
          />
        }
        description={
          dataset.origin === 'upload'
            ? `Uploaded from "${dataset.filename}". The rows, the columns and the thresholds are fixed at the moment it was recorded.`
            : `Frozen from the query "${dataset.queryLabel}". The rows, the sources and the thresholds are fixed at the moment of freezing.`
        }
        meta={
          <>
            <Badge tone="good" icon={Lock}>
              Immutable
            </Badge>
            <Tag>{dataset.origin === 'upload' ? dataset.fileFormat : dataset.queryKind}</Tag>
            <Tag mono={false}>
              {dataset.origin === 'upload' ? 'uploaded by' : 'frozen by'} {dataset.frozenBy}
            </Tag>
            {meta && <SourceTag meta={meta} />}
          </>
        }
        actions={
          <>
            <Button size="sm" variant="secondary" icon={Copy} onClick={copyCitation}>
              Copy citation
            </Button>
            <Button size="sm" variant="secondary" icon={Download} onClick={exportJson}>
              JSON
            </Button>
            <Button size="sm" variant="primary" icon={FileSpreadsheet} onClick={exportCsv}>
              CSV with citation
            </Button>
          </>
        }
      />

      <Banner tone="info" title="What immutable means here" icon={Lock}>
        {dataset.origin === 'upload'
          ? 'This dataset was frozen the moment the file was read, with the digest above. Uploading a corrected file creates a new dataset beside it, so a figure in a write-up always points at the exact rows that produced it.'
          : 'This snapshot is never recomputed. Running the same query again creates a new snapshot beside it, so a figure in a write-up always points at the exact rows that produced it.'}
      </Banner>

      <Grid cols={4}>
        <StatTile label="Rows" value={num(dataset.rowCount)} icon={FileStack} />
        <StatTile label="Columns" value={num(dataset.columns)} />
        <StatTile label="Size" value={bytes(dataset.sizeBytes)} />
        <StatTile
          label="Frozen"
          value={dateTime(dataset.frozenAt).split(' ')[0]}
          hint={`${dateTime(dataset.frozenAt, true)} UTC`}
        />
      </Grid>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Snapshot record" icon={Fingerprint} />
          <PanelBody>
            <KeyValue
              rows={[
                { label: 'Name', value: dataset.name, mono: false, wide: true },
                dataset.origin === 'upload'
                  ? { label: 'Uploaded file', value: dataset.filename, mono: false, wide: true }
                  : { label: 'Query', value: dataset.queryLabel, mono: false, wide: true },
                dataset.origin === 'upload'
                  ? {
                      label: 'File format',
                      value: dataset.delimiterLabel
                        ? `${dataset.fileFormat.toUpperCase()}, ${dataset.delimiterLabel} separated`
                        : dataset.fileFormat.toUpperCase(),
                      mono: false,
                    }
                  : { label: 'Query kind', value: dataset.queryKind },
                dataset.origin !== 'upload' && {
                  label: 'Parameters',
                  value: <code className="text-2xs">{dataset.queryJson}</code>,
                  wide: true,
                },
                { label: 'Rows', value: num(dataset.rowCount) },
                dataset.rowsTruncated && {
                  label: 'Rows stored',
                  value: `${num(dataset.rowsStored)} of ${num(dataset.rowCount)}`,
                },
                { label: 'Columns', value: num(dataset.columns) },
                { label: 'Checksum', value: dataset.checksum, wide: true },
                { label: 'Frozen at', value: `${dateTime(dataset.frozenAt, true)} UTC` },
                { label: 'Frozen by', value: dataset.frozenBy, mono: false },
                dataset.notes && { label: 'Notes', value: dataset.notes, mono: false, wide: true },
              ].filter(Boolean)}
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Thresholds in force when frozen"
            subtitle="A pass count is meaningless without the thresholds that produced it, so they travel with the snapshot."
            icon={SlidersHorizontal}
          />
          <PanelBody>
            <KeyValue
              rows={Object.entries(dataset.thresholdsUsed).map(([label, value]) => ({
                label: label.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
                value: String(value),
              }))}
            />
          </PanelBody>
          <PanelFooter>
            <InlineNote>
              If an administrator changes a platform threshold later, this snapshot is unaffected.
              A new snapshot would record the new value.
            </InlineNote>
          </PanelFooter>
        </Panel>
      </div>

      {/* An uploaded dataset carries its real rows, so they are shown. A query
          snapshot records its parameters and row count rather than the rows. */}
      {hasRows ? (
        <Section
          title="Rows"
          description={
            dataset.rowsTruncated
              ? `The first ${num(dataset.rowsStored)} of ${num(dataset.rowCount)} rows, as recorded.`
              : `All ${num(dataset.rowCount)} rows, as recorded.`
          }
          actions={
            <div className="flex items-center gap-2">
              <span className="text-2xs text-ink-faint">
                {num(fields.length)} columns
              </span>
              {fields.length > visibleColumns.length && (
                <Button size="xs" variant="ghost" onClick={() => setAllColumns((v) => !v)}>
                  {allColumns ? 'Show fewer columns' : `Show all ${fields.length}`}
                </Button>
              )}
            </div>
          }
        >
          <Panel>
            <PanelBody padded={false}>
              <div className="max-h-[28rem] overflow-auto">
                <table className="w-full text-2xs">
                  <thead className="sticky top-0 bg-surface-2">
                    <tr className="border-b border-line">
                      {visibleColumns.map((field) => (
                        <th
                          key={field.name}
                          className="whitespace-nowrap px-3 py-2 text-left font-medium text-ink-dim"
                        >
                          <span className="block">{field.name}</span>
                          <span className="block font-normal text-ink-faint">{field.type}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.rows.slice(0, rowsShown).map((row, i) => (
                      <tr key={i} className="border-b border-line/50 last:border-0 hover:bg-overlay/40">
                        {visibleColumns.map((field) => (
                          <td
                            key={field.name}
                            className={
                              field.type === 'integer' || field.type === 'number'
                                ? 'tnum whitespace-nowrap px-3 py-1.5 text-right font-mono text-ink-dim'
                                : 'max-w-[18rem] truncate px-3 py-1.5 font-mono text-ink-dim'
                            }
                          >
                            {row[field.name] === null ? (
                              <span className="text-ink-faint">&mdash;</span>
                            ) : (
                              String(row[field.name])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PanelBody>
            <PanelFooter>
              <span className="text-2xs text-ink-faint">
                Showing {num(Math.min(rowsShown, dataset.rows.length))} of {num(dataset.rows.length)}{' '}
                stored rows.
              </span>
              {rowsShown < dataset.rows.length && (
                <Button size="xs" variant="ghost" onClick={() => setRowsShown((n) => n + 100)}>
                  Show 100 more
                </Button>
              )}
            </PanelFooter>
          </Panel>
          {dataset.parseWarnings?.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {dataset.parseWarnings.map((warning) => (
                <InlineNote key={warning} icon={Lock}>
                  Recorded when the file was read: {warning}
                </InlineNote>
              ))}
            </div>
          )}
        </Section>
      ) : (
        <Section
          title="Rows"
          description="This snapshot was frozen from a query, so it records the query, the row count and the thresholds rather than a copy of the rows."
        >
          <Panel>
            <PanelBody>
              <InlineNote>
                Re-running the query reproduces the rows against the sources named below. An
                uploaded dataset stores its rows instead, because the file it came from is not
                something the platform can fetch again.
              </InlineNote>
            </PanelBody>
          </Panel>
        </Section>
      )}

      <Section title="Provenance" description="Recorded per source at the instant the snapshot was taken.">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {dataset.provenance.map((source) => (
            <Panel key={source.endpoint}>
              <PanelBody className="space-y-2">
                <p className="text-sm font-medium text-ink">{source.source}</p>
                <p className="break-all font-mono text-2xs text-ink-faint">{source.endpoint}</p>
                <KeyValue
                  dense
                  rows={[
                    { label: 'Retrieved', value: `${dateTime(source.retrievedAt, true)} UTC` },
                    { label: 'Licence', value: source.licence, mono: false, wide: true },
                  ]}
                />
              </PanelBody>
            </Panel>
          ))}
        </div>
      </Section>

      <Section title="Citation block" description="What an export of this snapshot carries at the top of the file.">
        <Panel>
          <PanelBody padded={false}>
            <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-4 font-mono text-2xs leading-relaxed text-ink-dim">
              {citation}
            </pre>
          </PanelBody>
          <PanelFooter>
            <Button size="xs" variant="outline" icon={Quote} onClick={copyCitation}>
              Copy citation
            </Button>
            <Link
              to={`/app/research/${workspaceId}/${projectId}`}
              className="link ml-auto text-2xs"
            >
              Back to the project
            </Link>
          </PanelFooter>
        </Panel>
      </Section>

      <InlineNote>
        Redistribution of element-set data is restricted by the provider agreement. Where a source
        carries that restriction it is stated in the licence line above and repeated in the export.
      </InlineNote>
    </div>
  );
}

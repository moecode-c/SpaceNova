import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, FileStack, FlaskConical, Lock, NotebookPen, Plus, Users,
} from 'lucide-react';
import { Grid, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, Section, StatTile } from '../../components/ui/panel.jsx';
import { Field, FormError, Input, Textarea } from '../../components/ui/form.jsx';
import { Badge, Button, Tag } from '../../components/ui/primitives.jsx';
import { Modal } from '../../components/ui/overlay.jsx';
import { EmptyState, InlineNote, LoadingState, useToast } from '../../components/ui/feedback.jsx';
import { SourceTag } from '../../components/data/source.jsx';
import { useApi, useAction } from '../../hooks/useApi.js';
import { workspaces as workspacesApi } from '../../api/index.js';
import { age, num } from '../../lib/format.js';

export default function WorkspaceList() {
  const navigate = useNavigate();
  const toast = useToast();
  const list = useApi(() => workspacesApi.list(), []);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const create = useAction(() => workspacesApi.create({ name, description }), {
    onSuccess: (workspace) => {
      setOpen(false);
      setName('');
      setDescription('');
      toast.success('Workspace created');
      navigate(`/app/research/${workspace.id}`);
    },
  });

  const rows = list.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={FlaskConical}
        title="Research workspaces"
        description="Private containers for a piece of work. Each holds projects, immutable dataset snapshots with full provenance, saved queries, notes and collaborators."
        meta={
          <>
            <Badge tone="info" size="sm" icon={Lock}>
              Private by default
            </Badge>
            {list.meta && <SourceTag meta={list.meta} />}
          </>
        }
        actions={
          <Button size="sm" variant="primary" icon={Plus} onClick={() => setOpen(true)}>
            New workspace
          </Button>
        }
      />

      <Grid cols={4}>
        <StatTile label="Workspaces" value={num(rows.length)} icon={FlaskConical} />
        <StatTile
          label="Projects"
          value={num(rows.reduce((n, w) => n + w.projectCount, 0))}
          hint="Across every workspace"
        />
        <StatTile
          label="Dataset snapshots"
          value={num(rows.reduce((n, w) => n + w.datasetCount, 0))}
          icon={FileStack}
          hint="Immutable, each with its provenance"
        />
        <StatTile
          label="Collaborators"
          value={num(rows.reduce((n, w) => n + w.collaboratorCount, 0))}
          icon={Users}
          hint="People invited to a workspace"
        />
      </Grid>

      {list.loading && rows.length === 0 ? (
        <Panel>
          <LoadingState label="Loading workspaces" />
        </Panel>
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon={FlaskConical}
            title="No workspaces yet"
            description="A workspace keeps one piece of research together: the queries you ran, the data you froze, and the notes that explain what you found."
            action={
              <Button size="sm" variant="primary" icon={Plus} onClick={() => setOpen(true)}>
                Create a workspace
              </Button>
            }
          />
        </Panel>
      ) : (
        <Section title="Your workspaces">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {rows.map((workspace) => (
              <Panel key={workspace.id}>
                <PanelHeader
                  title={workspace.name}
                  subtitle={workspace.description}
                  icon={FlaskConical}
                  actions={
                    workspace.collaboratorCount > 0 && (
                      <Badge tone="info" size="sm" icon={Users}>
                        {workspace.collaboratorCount} invited
                      </Badge>
                    )
                  }
                />
                <PanelBody>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      ['Projects', workspace.projectCount, FlaskConical],
                      ['Datasets', workspace.datasetCount, FileStack],
                      ['Notes', workspace.noteCount, NotebookPen],
                      ['People', workspace.collaboratorCount, Users],
                    ].map(([label, value, Icon]) => (
                      <div key={label} className="panel-inset px-2.5 py-2">
                        <p className="flex items-center gap-1.5 text-2xs text-ink-faint">
                          <Icon size={11} aria-hidden />
                          {label}
                        </p>
                        <p className="tnum mt-0.5 font-mono text-sm text-ink">{num(value)}</p>
                      </div>
                    ))}
                  </div>
                </PanelBody>
                <PanelFooter>
                  <Tag mono={false}>{workspace.ownerName}</Tag>
                  <span className="text-2xs text-ink-faint">updated {age(workspace.updatedAt)}</span>
                  <Link
                    to={`/app/research/${workspace.id}`}
                    className="link ml-auto inline-flex items-center gap-1 text-2xs"
                  >
                    Open
                    <ArrowRight size={11} aria-hidden />
                  </Link>
                </PanelFooter>
              </Panel>
            ))}
          </div>
        </Section>
      )}

      <Panel>
        <PanelHeader title="How a snapshot differs from a query" icon={FileStack} />
        <PanelBody className="space-y-2.5">
          <InlineNote>
            A saved query is a question. Re-running it next week gives a different answer, because
            the catalogue and the element sets have moved on.
          </InlineNote>
          <InlineNote>
            A dataset snapshot is an answer, frozen. It records the query, the row count and
            checksum, every source with its endpoint, retrieval time and licence, and the thresholds
            in force at the moment it was taken. It is never recomputed in place, so a figure in
            your write-up can be traced back to exactly the rows that produced it.
          </InlineNote>
        </PanelBody>
      </Panel>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New workspace"
        description="Workspaces are private. You choose who to invite and whether to share a read-only link."
        size="sm"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" loading={create.pending} onClick={() => create.run()}>
              Create workspace
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {create.error && create.error.code !== 'validation' && <FormError error={create.error} />}
          <Field label="Name" htmlFor="wsName" error={create.fieldErrors?.name} required>
            <Input
              id="wsName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pass prediction accuracy"
            />
          </Field>
          <Field label="Description" htmlFor="wsDesc" hint="What question this work is trying to answer.">
            <Textarea id="wsDesc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

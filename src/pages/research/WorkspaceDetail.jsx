import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight, FileStack, FlaskConical, Lock, Mail, NotebookPen, Plus, Trash2,
  Users,
} from 'lucide-react';
import { Grid, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, Section, StatTile } from '../../components/ui/panel.jsx';
import { Breadcrumbs, Tabs } from '../../components/ui/nav.jsx';
import { DataTable } from '../../components/ui/table.jsx';
import { Field, FormError, Input, Select, Textarea } from '../../components/ui/form.jsx';
import { Avatar, Badge, Button, IconButton, Tag } from '../../components/ui/primitives.jsx';
import { ConfirmDialog, Modal } from '../../components/ui/overlay.jsx';
import { EmptyState, ErrorState, InlineNote, LoadingState, useToast } from '../../components/ui/feedback.jsx';
import { SourceTag } from '../../components/data/source.jsx';
import { useApi, useAction } from '../../hooks/useApi.js';
import { workspaces as workspacesApi } from '../../api/index.js';
import { age, dateTime, num } from '../../lib/format.js';

export default function WorkspaceDetail() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('projects');
  const [projectOpen, setProjectOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState('read');

  const workspace = useApi(() => workspacesApi.get(workspaceId), [workspaceId]);
  const data = workspace.data;

  const createProject = useAction(
    () => workspacesApi.createProject(workspaceId, { name: projectName, description: projectDescription }),
    {
      onSuccess: (project) => {
        setProjectOpen(false);
        setProjectName('');
        setProjectDescription('');
        toast.success('Project created');
        navigate(`/app/research/${workspaceId}/${project.id}`);
      },
    },
  );

  const invite = useAction(() => workspacesApi.invite(workspaceId, { email, access }), {
    onSuccess: () => {
      setInviteOpen(false);
      setEmail('');
      toast.success('Invitation recorded', 'In Phase 2 this sends an email.');
      workspace.refetch();
    },
  });

  const removeCollaborator = useAction((userId) => workspacesApi.removeCollaborator(workspaceId, userId), {
    onSuccess: () => {
      toast.success('Collaborator removed');
      workspace.refetch();
    },
  });

  const removeWorkspace = useAction(() => workspacesApi.remove(workspaceId), {
    onSuccess: () => {
      toast.success('Workspace deleted');
      navigate('/app/research');
    },
  });

  if (workspace.loading && !data) return <LoadingState label="Loading workspace" />;
  if (workspace.error) return <ErrorState error={workspace.error} onRetry={workspace.reload} />;
  if (!data) return null;


  return (
    <div className="space-y-5">
      <PageHeader
        icon={FlaskConical}
        title={data.name}
        breadcrumb={
          <Breadcrumbs items={[{ label: 'Workspaces', to: '/app/research' }, { label: data.name }]} />
        }
        description={data.description}
        meta={
          <>
            <Badge tone="info" size="sm" icon={Lock}>
              Private
            </Badge>
            <Tag mono={false}>{data.ownerName}</Tag>
            <Tag mono={false}>created {age(data.createdAt)}</Tag>
            {workspace.meta && <SourceTag meta={workspace.meta} />}
          </>
        }
        actions={
          <>
            <Button size="sm" variant="secondary" icon={Users} onClick={() => setInviteOpen(true)}>
              Invite
            </Button>
            <Button size="sm" variant="primary" icon={Plus} onClick={() => setProjectOpen(true)}>
              New project
            </Button>
          </>
        }
      />

      <Grid cols={4}>
        <StatTile label="Projects" value={num(data.projects.length)} icon={FlaskConical} />
        <StatTile label="Dataset snapshots" value={num(data.datasetCount)} icon={FileStack} />
        <StatTile label="Notes" value={num(data.noteCount)} icon={NotebookPen} />
        <StatTile
          label="Collaborators"
          value={num(data.collaborators.length)}
          hint={
            data.collaborators.length
              ? 'Invited people, by read or edit access'
              : 'Private to you'
          }
          icon={Users}
        />
      </Grid>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'projects', label: 'Projects', icon: FlaskConical, count: data.projects.length },
          { value: 'people', label: 'Collaborators', icon: Users, count: data.collaborators.length },
        ]}
      />

      {tab === 'projects' && (
        data.projects.length === 0 ? (
          <Panel>
            <EmptyState
              icon={FlaskConical}
              title="No projects yet"
              description="A project groups the datasets and notes for one line of enquiry."
              action={
                <Button size="sm" variant="primary" icon={Plus} onClick={() => setProjectOpen(true)}>
                  Create a project
                </Button>
              }
            />
          </Panel>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {data.projects.map((project) => (
              <Panel key={project.id}>
                <PanelHeader title={project.name} subtitle={project.description} />
                <PanelBody className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ['Datasets', project.datasets.length],
                      ['Notes', project.notes.length],
                      ['Saved queries', project.savedQueries.length],
                    ].map(([label, value]) => (
                      <div key={label} className="panel-inset px-2.5 py-2">
                        <p className="text-2xs text-ink-faint">{label}</p>
                        <p className="tnum mt-0.5 font-mono text-sm text-ink">{num(value)}</p>
                      </div>
                    ))}
                  </div>
                  {project.datasets[0] && (
                    <p className="text-2xs text-ink-faint">
                      Latest snapshot: {project.datasets[0].name}, {num(project.datasets[0].rowCount)} rows,
                      frozen {age(project.datasets[0].frozenAt)}.
                    </p>
                  )}
                </PanelBody>
                <PanelFooter>
                  <span className="text-2xs text-ink-faint">updated {age(project.updatedAt)}</span>
                  <Link
                    to={`/app/research/${workspaceId}/${project.id}`}
                    className="link ml-auto inline-flex items-center gap-1 text-2xs"
                  >
                    Open project
                    <ArrowRight size={11} aria-hidden />
                  </Link>
                </PanelFooter>
              </Panel>
            ))}
          </div>
        )
      )}

      {tab === 'people' && (
        <Panel>
          <PanelHeader
            title="Collaborators"
            subtitle="Read access lets someone open the workspace. Edit access lets them add projects, notes and snapshots."
            icon={Users}
            actions={
              <Button size="xs" variant="outline" icon={Plus} onClick={() => setInviteOpen(true)}>
                Invite
              </Button>
            }
          />
          <DataTable
            rowKey={(c) => c.userId}
            columns={[
              {
                key: 'name',
                header: 'Person',
                nowrap: false,
                render: (c) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={c.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-ink">{c.name}</p>
                      <p className="truncate text-2xs text-ink-faint">{c.email}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: 'access',
                header: 'Access',
                render: (c) => (
                  <Select
                    className="h-7 w-28 text-2xs"
                    value={c.access}
                    onChange={async (e) => {
                      await workspacesApi.updateCollaborator(workspaceId, c.userId, { access: e.target.value });
                      workspace.refetch();
                    }}
                  >
                    <option value="read">Read</option>
                    <option value="edit">Edit</option>
                  </Select>
                ),
              },
              { key: 'invitedAt', header: 'Invited', mono: true, hideBelow: 'md', render: (c) => age(c.invitedAt) },
              {
                key: 'acceptedAt',
                header: 'Status',
                render: (c) =>
                  c.acceptedAt ? (
                    <Badge tone="good" size="sm">
                      Accepted
                    </Badge>
                  ) : (
                    <Badge tone="warn" size="sm">
                      Pending
                    </Badge>
                  ),
              },
              {
                key: 'remove',
                header: '',
                align: 'right',
                render: (c) => (
                  <IconButton
                    icon={Trash2}
                    label={`Remove ${c.name}`}
                    size="xs"
                    onClick={() => removeCollaborator.run(c.userId)}
                  />
                ),
              },
            ]}
            rows={data.collaborators}
            empty={
              <EmptyState
                compact
                icon={Users}
                title="No collaborators"
                description="Only you can see this workspace."
              />
            }
          />
        </Panel>
      )}

      <Panel>
        <PanelFooter>
          <Button size="xs" variant="danger" icon={Trash2} onClick={() => setDeleting(true)}>
            Delete workspace
          </Button>
          <span className="text-2xs text-ink-faint">
            Removes every project, dataset snapshot and note inside it.
          </span>
        </PanelFooter>
      </Panel>

      <Modal
        open={projectOpen}
        onClose={() => setProjectOpen(false)}
        title="New project"
        size="sm"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setProjectOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" loading={createProject.pending} onClick={() => createProject.run()}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {createProject.error && createProject.error.code !== 'validation' && (
            <FormError error={createProject.error} />
          )}
          <Field label="Name" htmlFor="pjName" error={createProject.fieldErrors?.name} required>
            <Input id="pjName" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          </Field>
          <Field label="Description" htmlFor="pjDesc">
            <Textarea
              id="pjDesc"
              rows={3}
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a collaborator"
        description="They receive an invitation and can accept it from their own account."
        size="sm"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" icon={Mail} loading={invite.pending} onClick={() => invite.run()}>
              Send invitation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {invite.error && invite.error.code !== 'validation' && <FormError error={invite.error} />}
          <Field label="Email address" htmlFor="invEmail" error={invite.fieldErrors?.email} required>
            <Input id="invEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Access" htmlFor="invAccess">
            <Select id="invAccess" value={access} onChange={(e) => setAccess(e.target.value)}>
              <option value="read">Read &mdash; can open everything in the workspace</option>
              <option value="edit">Edit &mdash; can also add projects, notes and snapshots</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => removeWorkspace.run()}
        loading={removeWorkspace.pending}
        title={`Delete ${data.name}?`}
        body="Every project, dataset snapshot and note inside it is removed, and every collaborator loses access immediately. This cannot be undone."
        confirmLabel="Delete workspace"
      />
    </div>
  );
}

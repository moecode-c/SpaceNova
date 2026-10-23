import { useState } from 'react';
import {
  AlertTriangle, KeyRound, Mail, ShieldCheck, Trash2, UserCog,
} from 'lucide-react';
import { Grid, KeyValue, PageHeader, Panel, PanelBody, PanelFooter, PanelHeader, Section, StatTile } from '../../components/ui/panel.jsx';
import { Field, FormError, Input, Select, Switch } from '../../components/ui/form.jsx';
import { Badge, Button, Tag } from '../../components/ui/primitives.jsx';
import { ConfirmDialog } from '../../components/ui/overlay.jsx';
import { Banner, InlineNote, useToast } from '../../components/ui/feedback.jsx';
import { useApi, useAction } from '../../hooks/useApi.js';
import { auth } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLES, ROLE_MATRIX } from '../../mock/people.js';
import { dateShort } from '../../lib/format.js';

const TIMEZONES = [
  'Africa/Cairo', 'Europe/London', 'Europe/Berlin', 'Europe/Stockholm',
  'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Kolkata',
  'Africa/Lagos', 'Australia/Sydney', 'UTC',
];

export default function Profile() {
  const toast = useToast();
  const { user, role, roleLabel, setUser, logout } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [institution, setInstitution] = useState(user?.institution ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? 'UTC');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const save = useAction(
    () => auth.updateProfile({ userId: user.id, patch: { name, institution, timezone } }),
    {
      onSuccess: (updated) => {
        setUser(updated);
        toast.success('Profile saved');
      },
    },
  );

  const removeAccount = useAction(() => auth.deleteAccount({ userId: user.id }), {
    onSuccess: async () => {
      await logout();
      window.location.href = '/';
    },
  });

  if (!user) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={UserCog}
        title="Profile and account"
        description="Your details, your role, and what happens to your data."
        meta={
          <>
            <Badge tone="primary" dot>
              {roleLabel}
            </Badge>
            {user.emailVerified ? (
              <Badge tone="good" size="sm" icon={Mail}>
                Email confirmed
              </Badge>
            ) : (
              <Badge tone="warn" size="sm" icon={AlertTriangle}>
                Email not confirmed
              </Badge>
            )}
            <Tag mono={false}>Member since {dateShort(user.createdAt)}</Tag>
          </>
        }
      />

      <Grid cols={3}>
        <StatTile label="Role" value={roleLabel} tone="primary" hint={ROLES[role]?.description} icon={ShieldCheck} />
        <StatTile label="Timezone" value={user.timezone} hint="Used for local time display only; storage is UTC" />
        <StatTile
          label="Two-factor"
          value={user.twoFactor ? 'Enabled' : 'Not enabled'}
          tone={user.twoFactor ? 'good' : 'warn'}
          hint="Managed by the back end in Phase 2"
          icon={KeyRound}
        />
      </Grid>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Your details" icon={UserCog} />
          <PanelBody className="space-y-4">
            {save.error && <FormError error={save.error} />}
            <Field label="Full name" htmlFor="pName">
              <Input id="pName" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email address" htmlFor="pEmail" hint="Changing this requires confirming the new address.">
              <Input id="pEmail" value={user.email} disabled />
            </Field>
            <Field label="Institution" htmlFor="pInst" hint="Shown on datasets you share with collaborators.">
              <Input id="pInst" value={institution} onChange={(e) => setInstitution(e.target.value)} />
            </Field>
            <Field label="Timezone" htmlFor="pTz">
              <Select id="pTz" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </Field>
          </PanelBody>
          <PanelFooter>
            <Button size="sm" variant="primary" loading={save.pending} onClick={() => save.run()}>
              Save changes
            </Button>
          </PanelFooter>
        </Panel>

        <div className="space-y-3">
          <Panel>
            <PanelHeader
              title="Role"
              subtitle="One role per account, set by an administrator."
              icon={ShieldCheck}
            />
            <PanelBody className="space-y-3">
              <div className="panel-inset space-y-1.5 p-3">
                <p className="text-xs font-medium text-ink">{roleLabel}</p>
                <p className="text-2xs leading-relaxed text-ink-faint">{ROLES[role]?.description}</p>
              </div>
              {role === 'admin' ? (
                <InlineNote>
                  Roles are set from the accounts screen. An administrator runs the platform and
                  does not hold another role's private work.
                </InlineNote>
              ) : (
                <InlineNote>
                  Your role is set by an administrator on your account. There is no request to
                  make from here.
                </InlineNote>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Security" icon={KeyRound} />
            <PanelBody className="space-y-3">
              <Switch
                checked={user.twoFactor}
                onChange={() => toast.info('Two-factor is wired up in Phase 2', 'It needs the back end to issue and verify codes.')}
                label="Two-factor authentication"
                description="An additional code at sign-in, issued by the server."
              />
              <Button size="sm" variant="outline" icon={KeyRound} onClick={() => toast.info('Password change needs the back end')}>
                Change password
              </Button>
              <InlineNote>
                Passwords are never handled by the front end in production: the form posts to the
                server, which hashes with bcrypt and invalidates other sessions.
              </InlineNote>
            </PanelBody>
          </Panel>
        </div>
      </div>

      <Section
        title="What each role can do"
        description="The privilege table the whole application is gated against. The sidebar, the route guards and this table all read from the same source."
      >
        <Panel>
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface">
                  <th className="label-caps px-3 py-2.5">Capability</th>
                  {['guest', 'user', 'researcher', 'engineer', 'admin'].map((key) => (
                    <th key={key} className="label-caps px-3 py-2.5 text-center">
                      {ROLES[key].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLE_MATRIX.map(([capability, roles]) => (
                  <tr key={capability} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2 text-xs text-ink-dim">{capability}</td>
                    {['guest', 'user', 'researcher', 'engineer', 'admin'].map((key) => (
                      <td key={key} className="px-3 py-2 text-center">
                        {roles.includes(key) ? (
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-good-soft text-good" aria-label="yes">
                            <ShieldCheck size={10} aria-hidden />
                          </span>
                        ) : (
                          <span className="text-2xs text-ink-faint" aria-label="no">
                            &mdash;
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Section>

      <Section title="Your data">
        <Panel>
          <PanelBody className="space-y-3">
            <KeyValue
              columns={2}
              rows={[
                { label: 'Stored about you', value: 'Name, email, institution, timezone, settings', mono: false },
                { label: 'Observer locations', value: 'Personal data, never shared by link', mono: false },
                { label: 'Telemetry retention', value: '30 days for raw samples', mono: false },
                { label: 'Account deletion', value: 'Removes everything, including locations and logs', mono: false },
              ]}
            />
            <Banner tone="warn" title="Deleting your account cannot be undone" compact>
              Your observer locations, plans, observation log and any workspaces you own are
              removed. Shared links you created stop working immediately.
            </Banner>
          </PanelBody>
          <PanelFooter>
            <Button size="sm" variant="danger" icon={Trash2} onClick={() => setDeleteOpen(true)}>
              Delete my account
            </Button>
          </PanelFooter>
        </Panel>
      </Section>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => removeAccount.run()}
        loading={removeAccount.pending}
        title="Delete your account?"
        body="Everything is removed: observer locations, plans, the observation log, and any workspaces you own. Share links you created stop working. This cannot be undone."
        confirmLabel="Delete everything"
      />
    </div>
  );
}

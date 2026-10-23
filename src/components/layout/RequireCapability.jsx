import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button } from '../ui/primitives.jsx';
import { LoadingState } from '../ui/feedback.jsx';
import { Panel, PanelBody } from '../ui/panel.jsx';
import { ROLES } from '../../mock/people.js';

/**
 * Route guard.
 *
 * Signed-out visitors are sent to the sign-in screen with the path they wanted
 * remembered. A signed-in account that simply lacks the capability is NOT
 * redirected: it is shown what the capability is and how to request the role,
 * which is the role-upgrade flow in SRS section 2.6.
 */
export function RequireCapability({ capability, roleNeeded }) {
  const { ready, user, can, roleLabel } = useAuth();
  const location = useLocation();

  if (!ready) return <LoadingState label="Checking your session" />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!can(capability)) {
    return <NoAccess capability={capability} roleNeeded={roleNeeded} currentRole={roleLabel} />;
  }

  return <Outlet />;
}

function NoAccess({ capability, roleNeeded, currentRole }) {
  const needed = roleNeeded ? ROLES[roleNeeded] : null;

  return (
    <Panel className="mx-auto max-w-2xl">
      <PanelBody className="space-y-5 p-8">
        <div className="flex items-start gap-3.5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-warn/40 bg-warn-soft/60 text-warn">
            <Lock size={18} aria-hidden />
          </span>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-ink">This area needs a different role</h1>
            <p className="text-sm leading-relaxed text-ink-dim">
              Your account is {/^[AEIOU]/i.test(currentRole) ? 'an' : 'a'}{' '}
              <span className="text-ink">{currentRole}</span>. This area is part of
              the <span className="text-ink">{capability}</span> capability
              {needed && (
                <>
                  , which belongs to the <span className="text-ink">{needed.label}</span> role
                </>
              )}
              .
            </p>
          </div>
        </div>

        {needed && (
          <div className="panel-inset space-y-2 p-3.5">
            <p className="label-caps">What the {needed.label} role adds</p>
            <p className="text-xs leading-relaxed text-ink-dim">{needed.description}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/app">
            <Button size="sm" variant="primary">
              Back to dashboard
            </Button>
          </Link>
        </div>

        <p className="text-2xs leading-relaxed text-ink-faint">
          Roles are set by an administrator on the account itself. While you are reviewing this
          build you can switch role from the account menu in the top right.
        </p>
      </PanelBody>
    </Panel>
  );
}

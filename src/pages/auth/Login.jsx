import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, LogIn } from 'lucide-react';
import { Button } from '../../components/ui/primitives.jsx';
import { Field, FormError, Input } from '../../components/ui/form.jsx';
import { Banner } from '../../components/ui/feedback.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAction } from '../../hooks/useApi.js';
import { DEMO_ACCOUNTS } from '../../api/auth.js';
import { ROLES } from '../../mock/people.js';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginAs } = useAuth();
  const from = location.state?.from ?? '/app';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const action = useAction((payload) => login(payload), {
    onSuccess: () => navigate(from, { replace: true }),
  });

  const submit = (e) => {
    e.preventDefault();
    action.run({ email, password });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-ink">Sign in</h1>
        <p className="text-sm text-ink-dim">
          Pick up your observer locations and plans where you left them.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-4" noValidate>
        {action.error && action.error.code !== 'validation' && <FormError error={action.error} />}

        <Field label="Email address" htmlFor="email" error={action.fieldErrors?.email} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={!!action.fieldErrors?.email}
            placeholder="you@example.org"
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={action.fieldErrors?.password}
          required
          hint="At least eight characters."
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!action.fieldErrors?.password}
            placeholder="••••••••"
          />
        </Field>

        <div className="flex items-center justify-between gap-3">
          <Link to="/forgot-password" className="link text-2xs">
            Forgotten your password?
          </Link>
        </div>

        <Button type="submit" variant="primary" size="lg" icon={LogIn} loading={action.pending} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="text-center text-xs text-ink-faint">
        No account yet?{' '}
        <Link to="/register" className="link">
          Create one
        </Link>
      </p>

      {/* Phase 1 affordance. There is no back end to authenticate against, so
          each of the five user classes is reachable directly for review. */}
      <div className="space-y-3 border-t border-line pt-5">
        <Banner tone="info" title="Reviewing this build" compact>
          No back end is connected, so any password of eight characters is accepted for a seeded
          address. Use a button below to enter as a particular role.
        </Banner>
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(DEMO_ACCOUNTS).map((role) => (
            <Button
              key={role}
              size="sm"
              variant="outline"
              iconRight={ArrowRight}
              onClick={async () => {
                await loginAs(role);
                navigate('/app', { replace: true });
              }}
            >
              {ROLES[role].label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

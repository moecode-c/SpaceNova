import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/primitives.jsx';
import { Field, FormError, Input } from '../../components/ui/form.jsx';
import { Banner } from '../../components/ui/feedback.jsx';
import { useAction } from '../../hooks/useApi.js';
import { auth } from '../../api/index.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [done, setDone] = useState(false);

  const action = useAction((payload) => auth.resetPassword(payload), {
    onSuccess: () => setDone(true),
  });

  if (done) {
    return (
      <div className="space-y-6 text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-good/40 bg-good-soft/60 text-good">
          <CheckCircle2 size={22} aria-hidden />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-ink">Password changed</h1>
          <p className="text-sm text-ink-dim">
            The reset link has been consumed and cannot be used again. Any other sessions have been
            signed out.
          </p>
        </div>
        <Button variant="primary" size="lg" className="w-full" onClick={() => navigate('/login')}>
          Sign in with the new password
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-primary">
          <ShieldCheck size={20} aria-hidden />
        </span>
        <h1 className="pt-2 text-xl font-semibold tracking-[-0.02em] text-ink">
          Choose a new password
        </h1>
        <p className="text-sm text-ink-dim">
          At least eight characters, with letters and numbers.
        </p>
      </header>

      {!token && (
        <Banner tone="warn" title="This link is incomplete">
          No reset token was supplied. Request a new link from the sign-in page.
        </Banner>
      )}

      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          action.run({ token, password, confirmPassword });
        }}
      >
        {action.error && action.error.code !== 'validation' && <FormError error={action.error} />}

        <Field label="New password" htmlFor="password" error={action.fieldErrors?.password} required>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!action.fieldErrors?.password}
          />
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="confirmPassword"
          error={action.fieldErrors?.confirmPassword}
          required
        >
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            invalid={!!action.fieldErrors?.confirmPassword}
          />
        </Field>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={action.pending}
          disabled={!token}
          className="w-full"
        >
          Change password
        </Button>
      </form>

      <p className="text-center text-xs text-ink-faint">
        <Link to="/login" className="link">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

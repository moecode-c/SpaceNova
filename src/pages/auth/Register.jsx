import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, UserPlus } from 'lucide-react';
import { Button } from '../../components/ui/primitives.jsx';
import { Checkbox, Field, FormError, Input } from '../../components/ui/form.jsx';
import { Banner } from '../../components/ui/feedback.jsx';
import { Meter } from '../../components/ui/panel.jsx';
import { useAction } from '../../hooks/useApi.js';
import { auth } from '../../api/index.js';

/** Simple strength indicator. The server validates independently. */
function strengthOf(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Strong'];
  const tones = ['bad', 'bad', 'warn', 'primary', 'good', 'good'];
  return { score, value: score / 5, label: labels[score], tone: tones[score] };
}

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false,
  });

  const strength = useMemo(() => strengthOf(form.password), [form.password]);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const action = useAction((payload) => auth.register(payload), {
    onSuccess: () => navigate('/verify-email', { state: { email: form.email } }),
  });

  const submit = (e) => {
    e.preventDefault();
    action.run(form);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl leading-[1.1] text-ink">Create an account</h1>
        <p className="text-sm text-ink-dim">
          New accounts are Observers. The Researcher and Engineer roles are requested afterwards and
          approved by an administrator.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-4" noValidate>
        {action.error && action.error.code !== 'validation' && <FormError error={action.error} />}

        <Field label="Full name" htmlFor="name" error={action.fieldErrors?.name} required>
          <Input
            id="name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
            invalid={!!action.fieldErrors?.name}
          />
        </Field>

        <Field
          label="Email address"
          htmlFor="email"
          error={action.fieldErrors?.email}
          hint="Used for verification, password reset and the alerts you choose to receive."
          required
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email')(e.target.value)}
            invalid={!!action.fieldErrors?.email}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={action.fieldErrors?.password} required>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set('password')(e.target.value)}
            invalid={!!action.fieldErrors?.password}
          />
          {form.password && (
            <Meter
              className="pt-1"
              value={strength.value}
              tone={strength.tone}
              label="Strength"
              right={strength.label}
            />
          )}
        </Field>

        <Field
          label="Confirm password"
          htmlFor="confirmPassword"
          error={action.fieldErrors?.confirmPassword}
          required
        >
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => set('confirmPassword')(e.target.value)}
            invalid={!!action.fieldErrors?.confirmPassword}
            suffix={
              form.confirmPassword && form.confirmPassword === form.password ? (
                <Check size={12} className="text-good" aria-hidden />
              ) : undefined
            }
          />
        </Field>

        <Field error={action.fieldErrors?.acceptedTerms}>
          <Checkbox
            checked={form.acceptedTerms}
            onChange={set('acceptedTerms')}
            label="I accept the terms of use"
            description="Including that this platform is not certified for operational, navigational or safety-critical use."
          />
        </Field>

        <Button type="submit" variant="primary" size="lg" icon={UserPlus} loading={action.pending} className="w-full">
          Create account
        </Button>
      </form>

      <Banner tone="info" title="What is stored" compact>
        Only your name, email address, timezone and settings. Your observer locations are treated as
        personal data: they are never shared without an explicit action and never placed in a URL.
      </Banner>

      <p className="text-center text-xs text-ink-faint">
        Already have an account?{' '}
        <Link to="/login" className="link">
          Sign in
        </Link>
      </p>
    </div>
  );
}

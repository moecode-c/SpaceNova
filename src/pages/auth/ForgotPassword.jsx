import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, MailCheck, Send } from 'lucide-react';
import { Button } from '../../components/ui/primitives.jsx';
import { Field, FormError, Input } from '../../components/ui/form.jsx';
import { Banner } from '../../components/ui/feedback.jsx';
import { useAction } from '../../hooks/useApi.js';
import { auth } from '../../api/index.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const action = useAction((payload) => auth.requestPasswordReset(payload), {
    onSuccess: () => setSent(true),
  });

  if (sent) {
    return (
      <div className="space-y-6">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-good/40 bg-good-soft/60 text-good">
          <MailCheck size={20} aria-hidden />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-2xl leading-[1.1] text-ink">Check your inbox</h1>
          <p className="text-sm leading-relaxed text-ink-dim">
            If an account exists for <span className="text-ink">{email}</span>, a single-use reset
            link is on its way. The link expires, and using it invalidates it.
          </p>
        </div>
        <Banner tone="info" title="Why the wording is careful" compact>
          The response is identical whether or not the address is registered. Telling a stranger
          which addresses have accounts would leak the account list.
        </Banner>
        <div className="flex flex-wrap gap-2">
          <Link to="/reset-password?token=demo-token">
            <Button size="sm" variant="outline">
              Open the reset form
            </Button>
          </Link>
          <Link to="/login">
            <Button size="sm" variant="ghost">
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-primary">
          <KeyRound size={20} aria-hidden />
        </span>
        <h1 className="pt-2 text-2xl leading-[1.1] text-ink">
          Reset your password
        </h1>
        <p className="text-sm leading-relaxed text-ink-dim">
          Enter the address on the account. A single-use link will be sent to it.
        </p>
      </header>

      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          action.run({ email });
        }}
      >
        {action.error && action.error.code !== 'validation' && <FormError error={action.error} />}
        <Field label="Email address" htmlFor="email" error={action.fieldErrors?.email} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={!!action.fieldErrors?.email}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" icon={Send} loading={action.pending} className="w-full">
          Send the reset link
        </Button>
      </form>

      <p className="text-center text-xs text-ink-faint">
        Remembered it?{' '}
        <Link to="/login" className="link">
          Sign in
        </Link>
      </p>
    </div>
  );
}

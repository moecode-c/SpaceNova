import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailCheck, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/primitives.jsx';
import { Field, FormError, Input } from '../../components/ui/form.jsx';
import { Banner, useToast } from '../../components/ui/feedback.jsx';
import { useAction } from '../../hooks/useApi.js';
import { auth } from '../../api/index.js';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const email = location.state?.email ?? params.get('email') ?? '';

  const [token, setToken] = useState(params.get('token') ?? '');
  const [verified, setVerified] = useState(false);

  const action = useAction((payload) => auth.verifyEmail(payload), {
    onSuccess: () => setVerified(true),
  });

  if (verified) {
    return (
      <div className="space-y-6 text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-good/40 bg-good-soft/60 text-good">
          <CheckCircle2 size={22} aria-hidden />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-2xl leading-[1.1] text-ink">Address confirmed</h1>
          <p className="text-sm text-ink-dim">
            Your account is active. Sign in and set an observer location to start planning.
          </p>
        </div>
        <Button variant="primary" size="lg" className="w-full" onClick={() => navigate('/login')}>
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-primary">
          <MailCheck size={20} aria-hidden />
        </span>
        <h1 className="pt-2 text-2xl leading-[1.1] text-ink">
          Confirm your email address
        </h1>
        <p className="text-sm leading-relaxed text-ink-dim">
          {email ? (
            <>
              A one-time link has been sent to <span className="text-ink">{email}</span>. It expires
              after a short window and can only be used once.
            </>
          ) : (
            'A one-time link has been sent to the address you registered. It expires after a short window and can only be used once.'
          )}
        </p>
      </header>

      <Banner tone="info" title="No mail is sent in this build" compact>
        Phase 1 has no mail service connected. Paste any six characters below to complete the step
        and see the confirmed state.
      </Banner>

      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          action.run({ token });
        }}
      >
        {action.error && <FormError error={action.error} />}
        <Field
          label="Verification code"
          htmlFor="token"
          hint="In production this is embedded in the link rather than typed."
        >
          <Input
            id="token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste the code from the email"
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={action.pending} className="w-full">
          Confirm address
        </Button>
      </form>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
        <Button
          size="sm"
          variant="ghost"
          icon={RefreshCw}
          onClick={() => toast.info('Verification link resent', 'Check the address you registered.')}
        >
          Resend the link
        </Button>
        <Link to="/login" className="link text-2xs">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

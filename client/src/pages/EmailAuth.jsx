import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MailCheck, ShieldCheck } from 'lucide-react';
import { Form, Field } from '../components/UI';
import { api } from '../lib/api';
export default function EmailAuth({ mode = 'verify' }) {
  const [params] = useSearchParams();
  return (
    <EmailAuthForm
      key={mode + ':' + (params.get('token') || '') + ':' + (params.get('email') || '')}
      mode={mode}
    />
  );
}
function EmailAuthForm({ mode }) {
  const [params] = useSearchParams();
  const [message, setMessage] = useState('');
  const token = params.get('token');
  const reset = mode === 'reset',
    forgot = mode === 'forgot';
  const title = reset
    ? 'Choose a new password'
    : forgot
      ? 'Get back to your workspace'
      : 'Verify your email';
  return (
    <main className="container auth-page email-auth">
      <section className="auth-story">
        <span className="pill">
          <ShieldCheck size={16} /> YOUR ACCOUNT, PROTECTED
        </span>
        <h1>
          A secure start.
          <br />
          <span>A brighter future.</span>
        </h1>
        <p>
          Your email connects you to your business, orders and account recovery. Open the link in
          your inbox to confirm it belongs to you.
        </p>
        <div className="story-card">
          <MailCheck />
          <div>
            <strong>Built around trust.</strong>
            <p>Secure links. Verified accounts. Your next chapter.</p>
          </div>
        </div>
      </section>
      <section className="panel auth-form">
        <div className="icon-tile">
          <MailCheck />
        </div>
        <h2>{title}</h2>
        <p className="muted">
          {reset
            ? 'The reset link expires after 30 minutes.'
            : forgot
              ? 'We will email a secure link if your account is eligible.'
              : 'Check your inbox and spam folder. Verification links expire after 24 hours.'}
        </p>
        {reset && !token ? (
          <div className="panel" role="alert">
            <p>Open the reset link from your email, or request a new link.</p>
            <Link className="button primary" to="/forgot-password">
              Request reset link
            </Link>
          </div>
        ) : message ? (
          <div role="status" className="panel">
            <p>{message}</p>
            <Link className="button primary" to="/login">
              Back to sign in
            </Link>
          </div>
        ) : (
          <Form
            submit={
              reset
                ? 'Update password'
                : forgot
                  ? 'Send reset link'
                  : token
                    ? 'Verify my email'
                    : 'Send verification link'
            }
            onSubmit={async (data) => {
              if (reset && data.password !== data.confirmPassword)
                throw new Error('Passwords do not match');
              const endpoint = reset
                ? 'reset-password'
                : forgot
                  ? 'forgot-password'
                  : token
                    ? 'verify-email'
                    : 'resend-verification';
              const result = await api('/auth/' + endpoint, {
                method: 'POST',
                body: token ? { token, password: data.password } : data,
              });
              setMessage(result.message);
            }}
          >
            {!token && (
              <Field
                label="Email address"
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={params.get('email') || ''}
              />
            )}
            {reset && (
              <>
                <Field
                  label="New password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={72}
                />
                <Field
                  label="Confirm password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={72}
                />
              </>
            )}
          </Form>
        )}
        <p className="auth-switch">
          <Link to="/login">Back to sign in</Link>
        </p>
      </section>
    </main>
  );
}

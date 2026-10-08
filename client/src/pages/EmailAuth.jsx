import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MailCheck,
  ShieldCheck,
  CircleCheck,
  ArrowUpRight,
  Store,
  ShoppingBag,
} from 'lucide-react';
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
  const [verifiedRole, setVerifiedRole] = useState(null);
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
        <h2>
          {message
            ? mode === 'verify' && token
              ? 'Email verified. You’re all set!'
              : reset
                ? 'Your fresh start is ready.'
                : 'Check your inbox.'
            : title}
        </h2>
        <p className="muted">
          {message
            ? 'A little peace of mind. A bigger next step.'
            : reset
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
          <VerificationNotice
            message={message}
            verified={mode === 'verify' && Boolean(token)}
            role={verifiedRole}
            reset={reset}
            onResend={!token && !reset ? () => setMessage('') : undefined}
          />
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
              setVerifiedRole(result.role || null);
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

function VerificationNotice({ message, verified, role, reset, onResend }) {
  const seller = role === 'seller',
    customer = role === 'customer';
  const heading = verified
    ? seller
      ? 'Let’s bring your business to life.'
      : customer
        ? 'Your next favorite is waiting.'
        : 'Welcome to your workspace.'
    : reset
      ? 'Back to doing what you love.'
      : 'Your next step is on its way.';
  const description = verified
    ? seller
      ? 'Build your storefront, share your products and start your journey with BizLaunch.'
      : customer
        ? 'Explore independent brands, discover thoughtful finds and shop with confidence.'
        : 'Your email is confirmed. Sign in to securely access your BizLaunch tools.'
    : reset
      ? 'Use your new password to sign in. Your previous sessions have been securely closed.'
      : 'If your account is eligible, look for a message from BizLaunch. Open its secure link to continue. Check your spam folder too.';
  const Icon = verified || reset ? CircleCheck : MailCheck;
  return (
    <div role="status" className="verification-notice">
      <div className="verification-seal">
        <Icon size={34} strokeWidth={1.8} />
      </div>
      <span className="verification-label">
        {verified
          ? 'EMAIL CONFIRMED'
          : reset
            ? 'PASSWORD UPDATED'
            : 'YOUR INBOX, YOUR NEXT CHAPTER'}
      </span>
      <h3>{heading}</h3>
      <p className="verification-description">{description}</p>
      <p className="verification-api-message">{message}</p>
      {verified && (
        <div className="verification-next">
          <span className="icon-tile">
            {seller ? (
              <Store size={18} />
            ) : customer ? (
              <ShoppingBag size={18} />
            ) : (
              <ShieldCheck size={18} />
            )}
          </span>
          <div>
            <strong>
              {seller
                ? 'Start with your business'
                : customer
                  ? 'Find something you love'
                  : 'Make your next move'}
            </strong>
            <span>
              {seller
                ? 'Your store, products and insights — together.'
                : customer
                  ? 'Beautiful brands. Easy orders. All in one place.'
                  : 'Your tools are ready when you sign in.'}
            </span>
          </div>
        </div>
      )}
      <Link className="button primary" to="/login">
        {verified
          ? seller
            ? 'Sign in & launch your business'
            : customer
              ? 'Sign in & start exploring'
              : 'Sign in to your workspace'
          : 'Back to sign in'}
        <ArrowUpRight size={17} />
      </Link>
      {onResend && (
        <button type="button" className="button secondary" onClick={onResend}>
          Use another email / resend link
        </button>
      )}
      <span className="verification-trust">
        <ShieldCheck size={14} /> Your account is protected, every step of the way.
      </span>
    </div>
  );
}

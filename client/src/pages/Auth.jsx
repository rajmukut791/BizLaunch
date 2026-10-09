import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Check, Sparkles, TrendingUp, ShoppingBag } from 'lucide-react';
import { useApp } from '../context/state';
import { api } from '../lib/api';
import { Form, Field, Select } from '../components/UI';
export default function Auth({ register = false }) {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const destination = (account) => {
    const next = params.get('next');
    if (
      next &&
      next.startsWith('/') &&
      !next.startsWith('//') &&
      !['/login', '/register'].includes(next)
    )
      return next;
    return ['seller', 'staff'].includes(account.role)
      ? '/seller'
      : account.role === 'admin'
        ? '/admin'
        : '/dashboard';
  };
  if (user) return <Navigate to={destination(user)} replace />;
  return (
    <main className="auth-page container">
      <section className="auth-story">
        <span className="pill">
          <Sparkles size={15} /> Your ambition starts here
        </span>
        <h1>
          A little idea.
          <br />A bigger
          <br />
          <span>possibility.</span>
        </h1>
        <p>
          Turn what you love into a business. Discover a marketplace made for independent brands and
          the people behind them.
        </p>
        <div className="auth-benefits">
          {[
            'Your own beautiful storefront',
            'Products, orders & finances together',
            'Insights that help you grow',
          ].map((value) => (
            <span key={value}>
              <Check size={17} />
              {value}
            </span>
          ))}
        </div>
        <div className="story-card">
          <div className="icon-tile">
            <TrendingUp />
          </div>
          <div>
            <strong>Make your next move.</strong>
            <p>Everything you need, in one place.</p>
          </div>
          <ArrowUpRight />
        </div>
      </section>
      <section className="auth-form panel">
        <div className="icon-tile">
          <ShoppingBag />
        </div>
        <p className="eyebrow">{register ? 'START SOMETHING GREAT' : 'WELCOME BACK'}</p>
        <h2>{register ? 'Create your account' : 'Good to see you again.'}</h2>
        <p className="muted">
          {register
            ? 'Your business journey starts with a simple step.'
            : 'Sign in and pick up where you left off.'}
        </p>
        <Form
          submit={register ? 'Create account' : 'Sign in'}
          onSubmit={async (data) => {
            if (register && data.confirmPassword !== data.password)
              throw new Error('Passwords must match');
            const result = await api('/auth/' + (register ? 'register' : 'login'), {
              method: 'POST',
              body: data,
            });
            if (result.verificationRequired) {
              navigate('/verify-email?email=' + encodeURIComponent(result.email), {
                replace: true,
              });
              return;
            }
            setUser(result.user);
            navigate(destination(result.user), { replace: true });
          }}
        >
          {register && (
            <Field
              label="Full name"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={60}
              placeholder="Your name"
            />
          )}
          <Field
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            required
            minLength={register ? 8 : 1}
            maxLength={72}
            placeholder={register ? 'At least 8 characters' : 'Enter your password'}
          />
          {register && (
            <>
              <Field
                label="Phone (optional)"
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={30}
              />
              <Field
                label="Confirm password"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
              />
              <Select label="I want to" name="role" defaultValue="customer">
                <option value="customer">Shop & discover brands</option>
                <option value="seller">Launch & manage a business</option>
              </Select>
            </>
          )}
        </Form>
        {!register && (
          <p className="auth-switch">
            <Link to="/forgot-password">Forgot password?</Link> ·{' '}
            <Link to="/verify-email">Verify email / resend link</Link>
          </p>
        )}
        <p className="auth-switch">
          {register ? 'Already have an account?' : 'New to BizLaunch?'}{' '}
          <Link
            to={
              (register ? '/login' : '/register') +
              (params.get('next') ? '?next=' + encodeURIComponent(params.get('next')) : '')
            }
          >
            {register ? 'Sign in' : 'Create an account'} <ArrowUpRight size={14} />
          </Link>
        </p>
      </section>
    </main>
  );
}

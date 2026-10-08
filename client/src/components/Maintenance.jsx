import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wrench, ShieldCheck, ArrowUpRight, RefreshCw, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../context/state';
import './Maintenance.css';
export function MaintenanceView({ maintenance, refresh, preview = false }) {
  return (
    <section className={'maintenance-view ' + (preview ? 'maintenance-preview' : 'container')}>
      <div className="maintenance-orbit" aria-hidden="true">
        <div />
        <span>
          <Wrench size={35} strokeWidth={1.5} />
        </span>
        <i>✦</i>
      </div>
      <span className="maintenance-eyebrow">A LITTLE TIME. A BETTER EXPERIENCE.</span>
      <h1>{maintenance.title}</h1>
      <p>{maintenance.message}</p>
      {maintenance.endsAt && (
        <div className="maintenance-eta">
          <Clock size={15} />
          <span>
            Planned reopening:{' '}
            {new Date(maintenance.endsAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
        </div>
      )}
      <div className="maintenance-assurance">
        <ShieldCheck size={17} />
        <span>Your account, orders and information are safely preserved.</span>
      </div>
      {!preview && (
        <div className="maintenance-actions">
          <button type="button" className="button primary" onClick={refresh}>
            Check availability <RefreshCw size={16} />
          </button>
          <Link to="/login" className="text-link">
            Sign in to your account <ArrowUpRight size={15} />
          </Link>
        </div>
      )}
      <span className="maintenance-signoff">Thank you for being part of BizLaunch.</span>
    </section>
  );
}
export default function MaintenanceBoundary({ children }) {
  const { user } = useApp();
  const { pathname } = useLocation();
  const [maintenance, setMaintenance] = useState(null),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await api('/platform/status', { cache: 'no-store' });
        if (active) {
          setMaintenance(result.maintenance);
          setError('');
        }
      } catch (e) {
        if (active) setError(e.message);
      }
    };
    const changed = (event) => {
      if (event.detail) setMaintenance(event.detail);
      else void refresh();
    };
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    void refresh();
    const timer = setInterval(visible, 30000);
    window.addEventListener('bizlaunch:maintenance', changed);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('bizlaunch:maintenance', changed);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  const refresh = async () => {
    try {
      const result = await api('/platform/status', { cache: 'no-store' });
      setMaintenance(result.maintenance);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };
  const authPage = [
    '/login',
    '/register',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
  ].includes(pathname);
  if (user?.role === 'admin' || authPage)
    return (
      <>
        {maintenance?.enabled && user?.role === 'admin' && (
          <div className="admin-maintenance-banner">
            <Wrench size={15} />
            <span>Maintenance is active. Your admin access remains available.</span>
            <Link to="/admin/maintenance">Manage settings ↗</Link>
          </div>
        )}
        {children}
      </>
    );
  if (!maintenance)
    return error ? (
      <div className="container content">
        <p role="alert">{error}</p>
        <button className="button secondary" onClick={refresh}>
          Retry connection
        </button>
      </div>
    ) : (
      <div className="loading">Preparing your BizLaunch experience…</div>
    );
  if (maintenance.enabled)
    return (
      <>
        {error && (
          <p className="container error" role="alert">
            {error}
          </p>
        )}
        <MaintenanceView maintenance={maintenance} refresh={refresh} />
      </>
    );
  return children;
}

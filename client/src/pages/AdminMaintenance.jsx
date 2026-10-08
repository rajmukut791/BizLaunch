import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, ShieldCheck, Globe, History, Eye, ArrowUpRight } from 'lucide-react';
import { useResource } from '../lib/hooks';
import { api, date } from '../lib/api';
import { State, Form, Field, Textarea, Select, Badge } from '../components/UI';
import { MaintenanceView } from '../components/Maintenance';
import './AdminPremium.css';
const localInput = (value) => {
  if (!value) return '';
  const time = new Date(value);
  return new Date(time - time.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export default function AdminMaintenance() {
  const resource = useResource('/admin/maintenance');
  const [preview, setPreview] = useState(null);
  return (
    <div className="admin-premium">
      <header className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">
            <Wrench size={14} /> PLATFORM CARE
          </span>
          <h1>Maintenance studio</h1>
          <p>Keep your community informed while you make things better.</p>
        </div>
        <Link className="button secondary" to="/admin">
          Back to overview <ArrowUpRight size={16} />
        </Link>
      </header>
      <State resource={resource}>
        {resource.data && (
          <>
            <div className="maintenance-admin-grid">
              <section className="admin-card maintenance-control">
                <div className="admin-card-heading">
                  <span className="admin-card-icon">
                    <Wrench />
                  </span>
                  <div>
                    <h2>Marketplace availability</h2>
                    <p>Clear communication. A smoother return.</p>
                  </div>
                  <Badge>{resource.data.maintenance.enabled ? 'Maintenance' : 'Online'}</Badge>
                </div>
                <Form
                  key={resource.data.maintenance.version}
                  submit="Save maintenance settings"
                  success="Maintenance settings saved"
                  onSubmit={async (data) => {
                    const body = {
                      enabled: data.enabled === 'true',
                      title: data.title,
                      message: data.message,
                      endsAt:
                        data.enabled === 'true' && data.endsAt
                          ? new Date(data.endsAt).toISOString()
                          : null,
                      version: resource.data.maintenance.version,
                    };
                    if (
                      body.enabled &&
                      !resource.data.maintenance.enabled &&
                      !window.confirm(
                        'Pause marketplace and customer/seller operations? Administrators will keep access.',
                      )
                    )
                      return false;
                    const result = await api('/admin/maintenance', { method: 'PATCH', body });
                    window.dispatchEvent(
                      new CustomEvent('bizlaunch:maintenance', { detail: result.maintenance }),
                    );
                    setPreview(null);
                    resource.reload();
                  }}
                >
                  <Select
                    label="Marketplace mode"
                    name="enabled"
                    defaultValue={String(resource.data.maintenance.enabled)}
                  >
                    <option value="false">Online — everyone can use BizLaunch</option>
                    <option value="true">Maintenance — admin access only</option>
                  </Select>
                  <Field
                    label="Maintenance headline"
                    name="title"
                    defaultValue={resource.data.maintenance.title}
                    required
                    minLength={3}
                    maxLength={90}
                  />
                  <Textarea
                    label="Message for customers & sellers"
                    name="message"
                    defaultValue={resource.data.maintenance.message}
                    required
                    minLength={10}
                    maxLength={600}
                  />
                  <Field
                    label="Automatically reopen at (optional)"
                    name="endsAt"
                    type="datetime-local"
                    defaultValue={localInput(resource.data.maintenance.endsAt)}
                  />
                  <p className="admin-form-note">
                    Leave the time empty to reopen manually. Scheduled reopening must be within 30
                    days.
                  </p>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={(event) => {
                      const data = Object.fromEntries(
                        new FormData(event.currentTarget.closest('form')),
                      );
                      setPreview({
                        title: data.title,
                        message: data.message,
                        endsAt: data.endsAt ? new Date(data.endsAt).toISOString() : null,
                      });
                    }}
                  >
                    <Eye size={16} /> Preview your message
                  </button>
                </Form>
              </section>
              <aside className="maintenance-admin-aside">
                <div className="admin-card">
                  <span className="admin-card-icon">
                    <ShieldCheck />
                  </span>
                  <h3>Always in control.</h3>
                  <p>
                    Admin tools stay available. Sign-in, email verification and password recovery
                    keep working.
                  </p>
                  <div className="admin-safe-list">
                    <span>
                      <ShieldCheck size={15} /> Orders and stock remain preserved
                    </span>
                    <span>
                      <Globe size={15} /> Marketplace operations pause securely
                    </span>
                    <span>
                      <Wrench size={15} /> Changes are recorded in the activity log
                    </span>
                  </div>
                </div>
                <div className="admin-care-note">
                  <span>THE LITTLE DETAILS MATTER</span>
                  <strong>
                    Make downtime
                    <br />
                    feel considered.
                  </strong>
                  <p>A clear message and reopening time help your community know what to expect.</p>
                </div>
              </aside>
            </div>
            {preview && (
              <section className="admin-card">
                <div className="admin-card-heading">
                  <Eye size={18} />
                  <h2>Customer & seller preview</h2>
                </div>
                <MaintenanceView maintenance={preview} preview />
              </section>
            )}
            <section className="admin-card">
              <div className="admin-card-heading">
                <History size={19} />
                <h2>Maintenance activity</h2>
                <span className="admin-soft-label">LAST 20 CHANGES</span>
              </div>
              {resource.data.maintenance.history?.length ? (
                <div className="admin-activity">
                  {[...resource.data.maintenance.history].reverse().map((entry, index) => (
                    <div key={entry._id || index}>
                      <span className={'admin-activity-dot ' + (entry.enabled ? 'paused' : '')} />
                      <div>
                        <strong>
                          {entry.enabled ? 'Maintenance enabled / updated' : 'Marketplace opened'}
                        </strong>
                        <span>
                          {entry.changedBy?.name || 'System'} · {date(entry.changedAt)}
                        </span>
                        <p>{entry.title}</p>
                      </div>
                      <Badge>{entry.enabled ? 'Maintenance' : 'Online'}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Your maintenance changes will appear here.</p>
              )}
            </section>
          </>
        )}
      </State>
    </div>
  );
}

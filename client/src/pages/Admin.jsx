import { Link } from 'react-router-dom';
import './AdminPremium.css';
import {
  Users as UsersIcon,
  Store,
  Package,
  ShoppingBag,
  ShieldCheck,
  Flag,
  Wrench,
  BarChart3,
  ArrowUpRight,
} from 'lucide-react';
import { useResource } from '../lib/hooks';
import { api, currency, date } from '../lib/api';
import { useApp } from '../context/state';
import {
  State,
  PageTitle,
  Badge,
  Form,
  Field,
  Textarea,
  Select,
  Action,
  Empty,
} from '../components/UI';
export function AdminDashboard() {
  const resource = useResource('/admin/overview'),
    status = useResource('/platform/status');
  const { user } = useApp();
  return (
    <div className="admin-premium">
      <header className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">
            <ShieldCheck size={14} /> YOUR PLATFORM, THOUGHTFULLY MANAGED
          </span>
          <h1>Platform overview</h1>
          <p>Welcome back, {user?.name.split(' ')[0]}. A clear view of what matters today.</p>
        </div>
        <Link className="button secondary" to="/admin/maintenance">
          <Wrench size={16} /> Maintenance studio
        </Link>
      </header>
      <State resource={resource}>
        {resource.data && (
          <>
            <section className="admin-command">
              <div>
                <span className="admin-command-label">
                  <span />{' '}
                  {status.data?.maintenance.enabled
                    ? 'MAINTENANCE ACTIVE'
                    : status.data
                      ? 'MARKETPLACE ONLINE'
                      : 'CHECKING AVAILABILITY'}
                </span>
                <h2>
                  A trusted marketplace.
                  <br />
                  <span>A community worth caring for.</span>
                </h2>
                <p>Your people, businesses and platform operations — beautifully together.</p>
                <Link to="/admin/businesses">
                  Review your businesses <ArrowUpRight size={16} />
                </Link>
              </div>
              <div className="admin-command-art" aria-hidden="true">
                <div />
                <span>
                  <ShieldCheck size={54} strokeWidth={1.3} />
                </span>
                <i>✦</i>
                <b>CARE · TRUST · GROWTH</b>
              </div>
            </section>
            <div className="admin-metrics">
              {[
                [UsersIcon, 'People', 'users', 'All registered accounts'],
                [Store, 'Businesses', 'businesses', 'Independent brands'],
                [Package, 'Active products', 'products', 'Current catalog'],
                [ShoppingBag, 'Orders', 'orders', 'Orders across the platform'],
              ].map(([Icon, label, key, note]) => (
                <div className="admin-card admin-metric" key={key}>
                  <div>
                    <span className="admin-card-icon">
                      <Icon size={19} />
                    </span>
                    <span className="admin-soft-label">PLATFORM</span>
                  </div>
                  <span className="admin-metric-label">{label}</span>
                  <strong>{resource.data.overview[key]}</strong>
                  <small>{note}</small>
                </div>
              ))}
            </div>
            <div className="admin-overview-grid">
              <section className="admin-card admin-order-chart">
                <div className="admin-card-heading">
                  <div>
                    <span className="admin-soft-label">A PULSE ON YOUR PLATFORM</span>
                    <h2>Order activity</h2>
                  </div>
                  <span className="admin-range">Last 7 days</span>
                </div>
                <div
                  className="admin-bars"
                  role="img"
                  aria-label={
                    'Orders by date: ' +
                    (resource.data.activity || [])
                      .map((day) => day.date + ': ' + day.orders)
                      .join(', ')
                  }
                >
                  {(resource.data.activity || []).map((day) => (
                    <div key={day.date}>
                      <span>{day.orders}</span>
                      <div className="admin-bar-track">
                        <i
                          style={{
                            height:
                              (Math.max(0, day.orders) /
                                Math.max(1, ...resource.data.activity.map((d) => d.orders))) *
                                100 +
                              '%',
                          }}
                        />
                      </div>
                      <small>
                        {new Date(day.date + 'T12:00:00Z').toLocaleDateString('en-GB', {
                          weekday: 'short',
                        })}
                      </small>
                    </div>
                  ))}
                </div>
                <p className="admin-chart-note">New orders by day · Asia/Dhaka</p>
              </section>
              <section className="admin-card admin-revenue">
                <span className="admin-card-icon">
                  <BarChart3 size={21} />
                </span>
                <span className="admin-soft-label">DELIVERED MARKETPLACE SALES</span>
                <strong>{currency(resource.data.overview.revenue)}</strong>
                <p>Delivered sales after discounts and completed refunds.</p>
                <div>
                  <ShieldCheck size={15} /> Paid refunds: {currency(resource.data.overview.refunds)}
                </div>
                <Link to="/admin/orders">
                  Explore orders <ArrowUpRight size={15} />
                </Link>
              </section>
            </div>
            <div className="admin-card-heading admin-section-title">
              <div>
                <span className="admin-soft-label">THE NEXT RIGHT MOVE</span>
                <h2>Your attention, where it matters.</h2>
              </div>
            </div>
            <div className="admin-attention">
              <Link className="admin-card admin-task" to="/admin/businesses">
                <span className="admin-card-icon">
                  <Store size={20} />
                </span>
                <strong>{resource.data.overview.pending}</strong>
                <h3>Businesses awaiting review</h3>
                <p>Help new brands take their first step into the marketplace.</p>
                <span>
                  Review businesses <ArrowUpRight size={16} />
                </span>
              </Link>
              <Link className="admin-card admin-task" to="/admin/reports">
                <span className="admin-card-icon">
                  <Flag size={20} />
                </span>
                <strong>{resource.data.overview.reports}</strong>
                <h3>Open customer reports</h3>
                <p>Listen to concerns and keep your community moving forward.</p>
                <span>
                  Manage reports <ArrowUpRight size={16} />
                </span>
              </Link>
              <Link className="admin-card admin-task admin-task-care" to="/admin/maintenance">
                <span className="admin-card-icon">
                  <Wrench size={20} />
                </span>
                <strong>
                  {status.data ? (status.data.maintenance.enabled ? 'Paused' : 'Online') : '—'}
                </strong>
                <h3>Thoughtful platform care</h3>
                <p>Control availability, preview your message and plan your return.</p>
                <span>
                  Open maintenance studio <ArrowUpRight size={16} />
                </span>
              </Link>
            </div>
            <section className="admin-card admin-quick">
              <div>
                <h2>Keep things beautifully organized.</h2>
                <p>Everything you need to manage your platform.</p>
              </div>
              <div>
                <Link to="/admin/users">
                  <UsersIcon size={17} /> People
                </Link>
                <Link to="/admin/categories">
                  <Package size={17} /> Categories
                </Link>
                <Link to="/admin/orders">
                  <ShoppingBag size={17} /> Orders
                </Link>
              </div>
            </section>
          </>
        )}
      </State>
    </div>
  );
}

export function Businesses() {
  const resource = useResource('/admin/businesses');
  return (
    <>
      <PageTitle
        eyebrow="BUILD A TRUSTED MARKETPLACE"
        title="Business verification"
        description="Review store details, approve submissions or disable a business."
      />
      <State resource={resource}>
        {resource.data?.businesses.length ? (
          <div className="management-grid">
            {resource.data.businesses.map((business) => (
              <section className="panel" key={business._id + business.updatedAt}>
                <div className="section-heading">
                  <h2>{business.name}</h2>
                  <Badge>{business.verification}</Badge>
                </div>
                <p>{business.description}</p>
                <div className="detail-list">
                  <span>
                    <strong>Owner</strong>
                    {business.owner?.name} · {business.owner?.email}
                  </span>
                  <span>
                    <strong>Phone</strong>
                    {business.phone}
                  </span>
                  <span>
                    <strong>Address</strong>
                    {business.address}
                  </span>
                  <span>
                    <strong>Store</strong>/stores/{business.slug}
                  </span>
                </div>
                <Form
                  submit="Save review"
                  success="Business review saved"
                  onSubmit={async (values) => {
                    await api('/admin/businesses/' + business._id, {
                      method: 'PATCH',
                      body: { ...values, active: values.active === 'true' },
                    });
                    resource.reload();
                  }}
                >
                  <div className="form-grid">
                    <Select
                      label="Verification"
                      name="verification"
                      defaultValue={business.verification}
                    >
                      {['pending', 'approved', 'rejected'].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </Select>
                    <Select
                      label="Availability"
                      name="active"
                      defaultValue={String(business.active)}
                    >
                      <option value="true">Active</option>
                      <option value="false">Disabled</option>
                    </Select>
                  </div>
                  <Textarea
                    label="Review note"
                    name="note"
                    defaultValue={business.verificationNote}
                    maxLength={500}
                  />
                </Form>
              </section>
            ))}
          </div>
        ) : (
          <Empty title="No businesses submitted yet." />
        )}
      </State>
    </>
  );
}
export function Categories() {
  const resource = useResource('/categories');
  return (
    <>
      <PageTitle
        eyebrow="KEEP DISCOVERY ORGANIZED"
        title="Categories"
        description="Create and maintain the marketplace's shared product categories."
      />
      <section className="panel">
        <h2>New category</h2>
        <Form
          submit="Add category"
          success="Category added"
          onSubmit={async (values, element) => {
            await api('/admin/categories', { method: 'POST', body: values });
            element.reset();
            resource.reload();
          }}
        >
          <div className="form-grid">
            <Field label="Name" name="name" required minLength={2} maxLength={80} />
            <Field label="Description" name="description" maxLength={500} />
          </div>
        </Form>
      </section>
      <State resource={resource}>
        <div className="management-grid">
          {resource.data?.categories.map((category) => (
            <section className="panel" key={category._id + category.updatedAt}>
              <Form
                submit="Update category"
                success="Category updated"
                onSubmit={async (values) => {
                  await api('/admin/categories/' + category._id, { method: 'PATCH', body: values });
                  resource.reload();
                }}
              >
                <Field
                  label="Name"
                  name="name"
                  defaultValue={category.name}
                  required
                  minLength={2}
                  maxLength={80}
                />
                <Field
                  label="Description"
                  name="description"
                  defaultValue={category.description}
                  maxLength={500}
                />
              </Form>
              <Action
                className="button danger small"
                confirm="Delete this category? Categories containing products cannot be deleted."
                onClick={async () => {
                  await api('/admin/categories/' + category._id, { method: 'DELETE', body: {} });
                  resource.reload();
                }}
              >
                Delete category
              </Action>
            </section>
          ))}
        </div>
      </State>
    </>
  );
}
export function Users() {
  const resource = useResource('/admin/users'),
    { user } = useApp();
  return (
    <>
      <PageTitle
        eyebrow="PEOPLE BEHIND THE PLATFORM"
        title="Users"
        description="Manage account access. Administrator accounts are protected."
      />
      <State resource={resource}>
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {resource.data?.users.map((person) => (
                <tr key={person._id}>
                  <td>
                    <strong>{person.name}</strong>
                    <small>{person.email}</small>
                  </td>
                  <td>
                    <Badge>{person.role}</Badge>
                  </td>
                  <td>
                    <Badge>{person.status}</Badge>
                  </td>
                  <td>{date(person.createdAt)}</td>
                  <td>
                    {person.role !== 'admin' && person._id !== user.id && (
                      <Action
                        confirm={
                          person.status === 'active'
                            ? 'Suspend this user and invalidate their sessions?'
                            : undefined
                        }
                        onClick={async () => {
                          await api('/admin/users/' + person._id, {
                            method: 'PATCH',
                            body: { status: person.status === 'active' ? 'suspended' : 'active' },
                          });
                          resource.reload();
                        }}
                      >
                        {person.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </Action>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </State>
    </>
  );
}
export function AdminReports() {
  const resource = useResource('/admin/reports');
  return (
    <>
      <PageTitle
        eyebrow="LISTEN. REVIEW. RESOLVE."
        title="Customer reports"
        description="Review concerns about businesses and notify the reporter when you update their case."
      />
      <State resource={resource}>
        {resource.data?.reports.length ? (
          <div className="management-grid">
            {resource.data.reports.map((report) => (
              <section className="panel" key={report._id + report.updatedAt}>
                <div className="section-heading">
                  <h2>{report.business?.name}</h2>
                  <Badge>{report.status}</Badge>
                </div>
                <p>
                  <Badge>{report.targetType || 'business'}</Badge> · {report.targetId}
                </p>
                <p>{report.reason}</p>
                <small className="muted">
                  Reported by {report.reporter?.name} · {date(report.createdAt)}
                </small>
                <Form
                  submit="Update report"
                  success="Report updated"
                  onSubmit={async (values) => {
                    await api('/admin/reports/' + report._id, { method: 'PATCH', body: values });
                    resource.reload();
                  }}
                >
                  <Select label="Status" name="status" defaultValue={report.status}>
                    {['open', 'resolved', 'dismissed'].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </Select>
                  <Textarea
                    label="Resolution"
                    name="resolution"
                    defaultValue={report.resolution}
                    maxLength={1000}
                  />
                </Form>
              </section>
            ))}
          </div>
        ) : (
          <Empty
            title="No customer reports."
            description="Business reports submitted by customers appear here."
          />
        )}
      </State>
    </>
  );
}

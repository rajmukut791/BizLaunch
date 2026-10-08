import { Link } from 'react-router-dom';
import { Users as UsersIcon, Store, Package, ShoppingBag, ShieldCheck, Flag } from 'lucide-react';
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
  const resource = useResource('/admin/overview');
  return (
    <>
      <PageTitle
        eyebrow="THE BIG PICTURE"
        title="Platform overview"
        description="Keep the marketplace trusted, active and growing."
      />
      <State resource={resource}>
        {resource.data && (
          <>
            <div className="stats-grid">
              {[
                [UsersIcon, 'Users', 'users'],
                [Store, 'Businesses', 'businesses'],
                [Package, 'Active products', 'products'],
                [ShoppingBag, 'Orders', 'orders'],
              ].map(([Icon, label, key]) => (
                <div className="stat" key={key}>
                  <Icon size={22} />
                  <span>{label}</span>
                  <strong>{resource.data.overview[key]}</strong>
                </div>
              ))}
            </div>
            <div className="dashboard-grid">
              <section className="panel">
                <span className="icon-tile">
                  <ShieldCheck />
                </span>
                <h2>{resource.data.overview.pending} businesses awaiting review</h2>
                <p className="muted">
                  Approve businesses before their products appear in the marketplace.
                </p>
                <Link className="button primary" to="/admin/businesses">
                  Review businesses ↗
                </Link>
              </section>
              <section className="panel">
                <span className="icon-tile">
                  <Flag />
                </span>
                <h2>{resource.data.overview.reports} open reports</h2>
                <p className="muted">Review customer concerns and record your resolution.</p>
                <Link className="button secondary" to="/admin/reports">
                  Manage reports ↗
                </Link>
              </section>
            </div>
            <section className="panel">
              <p className="eyebrow">DELIVERED MARKETPLACE SALES</p>
              <div className="health-score">{currency(resource.data.overview.revenue)}</div>
              <p className="muted">
                Sales value after discounts, recognized for delivered store fulfillments.
              </p>
            </section>
          </>
        )}
      </State>
    </>
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

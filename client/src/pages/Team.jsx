import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useApp } from '../context/state';
import { useResource } from '../lib/hooks';
import { api, date } from '../lib/api';
import { PageTitle, State, Form, Select, Action, Badge, Empty } from '../components/UI';
export function Team() {
  const resource = useResource('/seller/team'),
    { notify } = useApp(),
    {
      register,
      handleSubmit,
      formState: { isSubmitting, errors },
      reset,
    } = useForm();
  return (
    <>
      <PageTitle
        eyebrow="BUILD YOUR TEAM"
        title="Staff & permissions"
        description="Invite verified colleagues and give them the access their job needs."
      />
      <section className="panel">
        <h2>Invite a colleague</h2>
        <form
          className="form"
          onSubmit={handleSubmit(async (values) => {
            try {
              await api('/seller/team', { method: 'POST', body: values });
              notify('Invitation emailed');
              reset();
              resource.reload();
            } catch (error) {
              notify(error.message);
            }
          })}
        >
          <div className="form-grid">
            <label className="field">
              <span>Staff email</span>
              <input
                type="email"
                {...register('email', { required: true, maxLength: 254 })}
                required
                aria-label="Staff email"
              />
            </label>
            <label className="field">
              <span>Position</span>
              <select {...register('job')} aria-label="Position">
                <option value="inventory">Inventory staff</option>
                <option value="sales">Sales staff</option>
                <option value="manager">Manager</option>
              </select>
            </label>
          </div>
          {errors.email && <p className="error">Enter a valid email address.</p>}
          <button className="button primary" disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send staff invitation'}
          </button>
        </form>
        <p className="muted">
          Inventory: stock only. Sales: orders, customers and reviews. Manager: catalog, inventory,
          orders, customers, finance, reviews and store settings. Only the owner manages staff.
        </p>
      </section>
      <State resource={resource}>
        {resource.data?.members.length ? (
          resource.data.members.map((member) => (
            <section className="panel" key={member._id}>
              <div className="section-heading">
                <h2>{member.user?.name || member.email}</h2>
                <Badge>{member.status}</Badge>
              </div>
              <p>
                {member.email} · {member.job} · Invited {date(member.createdAt)}
              </p>
              <div className="badges">
                {member.permissions.map((permission) => (
                  <Badge key={permission}>{permission}</Badge>
                ))}
              </div>
              {member.status !== 'revoked' && (
                <>
                  <Form
                    submit="Update staff position"
                    success="Staff access updated"
                    onSubmit={async (values) => {
                      await api('/seller/team/' + member._id, { method: 'PATCH', body: values });
                      resource.reload();
                    }}
                  >
                    <Select label="Staff position" name="job" defaultValue={member.job}>
                      <option value="inventory">Inventory staff</option>
                      <option value="sales">Sales staff</option>
                      <option value="manager">Manager</option>
                    </Select>
                  </Form>
                  <Action
                    confirm="Revoke this colleague’s access immediately?"
                    onClick={async () => {
                      await api('/seller/team/' + member._id, {
                        method: 'PATCH',
                        body: { status: 'revoked' },
                      });
                      resource.reload();
                    }}
                  >
                    Revoke access
                  </Action>
                </>
              )}
            </section>
          ))
        ) : (
          <Empty title="Your team starts with an invitation" />
        )}
      </State>
    </>
  );
}
export function TeamInvite() {
  const [params] = useSearchParams(),
    { user, setUser } = useApp(),
    navigate = useNavigate();
  const token = params.get('token') || '',
    next = '/team-invite?token=' + encodeURIComponent(token);
  return (
    <main className="container content">
      <section className="panel form-panel">
        <PageTitle
          eyebrow="YOU’RE INVITED"
          title="Join your business team"
          description="Use the invited email and verify your mailbox before accepting. Invitations expire after seven days."
        />
        {user ? (
          <Form
            submit="Accept staff invitation"
            onSubmit={async () => {
              await api('/team-invites/accept', { method: 'POST', body: { token } });
              setUser(null);
              navigate('/login');
            }}
          >
            <p>
              Signed in as <strong>{user.email}</strong>
            </p>
          </Form>
        ) : (
          <>
            <Link className="button primary" to={'/login?next=' + encodeURIComponent(next)}>
              Sign in to accept
            </Link>
            <Link className="text-link" to={'/register?next=' + encodeURIComponent(next)}>
              Create your account ↗
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
export function StaffHome() {
  const { user } = useApp();
  const links = [
    ['products', '/seller/products', 'Products'],
    ['inventory', '/seller/inventory', 'Inventory'],
    ['orders', '/seller/orders', 'Orders'],
    ['customers', '/seller/customers', 'Customers'],
    ['finance', '/seller/analytics', 'Financial analytics'],
    ['reviews', '/seller/reviews', 'Reviews'],
    ['settings', '/seller/business', 'Store settings'],
  ];
  return (
    <>
      <PageTitle
        eyebrow="STAFF WORKSPACE"
        title={'Welcome, ' + user.name.split(' ')[0]}
        description="Your workspace reflects the permissions granted by your business owner."
      />
      <div className="management-grid">
        {links
          .filter(([permission]) => user.permissions?.includes(permission))
          .map(([, to, label]) => (
            <Link className="panel" to={to} key={to}>
              <h2>{label}</h2>
              <span className="text-link">Open workspace ↗</span>
            </Link>
          ))}
      </div>
    </>
  );
}

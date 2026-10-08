import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Package, CheckCircle2, Truck, ShoppingBag, ArrowUpRight } from 'lucide-react';
import { useApp } from '../context/state';
import { api, currency, date, getId } from '../lib/api';
import { useResource } from '../lib/hooks';
import { State, Empty, PageTitle, Badge, Action, Form, Select, Field } from '../components/UI';
import { OrderRefunds } from './OrderRefunds';
import './Orders.css';
const transitions = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};
export function Orders() {
  const [params, setParams] = useSearchParams(),
    { user } = useApp();
  const resource = useResource('/orders?' + params.toString());
  const changePage = (page) => {
    const next = new URLSearchParams(params);
    next.set('page', page);
    setParams(next);
  };
  return (
    <main className={user.role === 'customer' ? 'container content orders-page' : 'orders-page'}>
      <PageTitle
        eyebrow={user.role + ' workspace'}
        title="Orders"
        description="A clear view of every order. Search, review and keep things moving."
        action={
          user.role === 'admin' && (
            <button className="button secondary" onClick={() => setParams({ refund: 'requested' })}>
              Review refund requests
            </button>
          )
        }
      />
      <section className="panel order-filters">
        <div className="section-heading">
          <h2>Find an order</h2>
          <span className="muted">Dates in Bangladesh time</span>
        </div>
        <form
          key={params.toString()}
          onSubmit={(event) => {
            event.preventDefault();
            const next = new URLSearchParams();
            for (const [key, value] of new FormData(event.currentTarget))
              if (value) next.set(key, value);
            setParams(next);
          }}
        >
          <div className="order-filter-grid">
            <Field
              label="Customer, email or order"
              name="q"
              maxLength={80}
              placeholder="Search name, order or phone…"
              defaultValue={params.get('q') || ''}
            />
            <Field
              label="From date"
              name="from"
              type="date"
              defaultValue={params.get('from') || ''}
            />
            <Field label="To date" name="to" type="date" defaultValue={params.get('to') || ''} />
            <Select label="Delivery status" name="status" defaultValue={params.get('status') || ''}>
              <option value="">All statuses</option>
              {Object.keys(transitions).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <Select label="Refund status" name="refund" defaultValue={params.get('refund') || ''}>
              <option value="">All refunds</option>
              {['none', 'requested', 'approved', 'completed', 'rejected'].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <Select label="Sort by" name="sort" defaultValue={params.get('sort') || 'newest'}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </Select>
            <Select label="Orders per page" name="limit" defaultValue={params.get('limit') || '20'}>
              {[5, 10, 20, 50].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
          </div>
          <div className="order-filter-actions">
            <button className="button primary" type="submit">
              Apply filters
            </button>
            <button type="button" className="button secondary" onClick={() => setParams({})}>
              Reset filters
            </button>
          </div>
        </form>
      </section>
      <State resource={resource}>
        {resource.data && (
          <>
            <div className="order-counts">
              <span>
                <strong>{resource.data.total}</strong> matching orders
              </span>
              <span>
                <strong>{resource.data.summary.inProgress}</strong> in progress
              </span>
              <span>
                <strong>{resource.data.summary.refundRequests}</strong> refunds awaiting review
              </span>
            </div>
            {resource.data.orders.length ? (
              <div className="panel table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Status / refund</th>
                      <th>Date</th>
                      <th>Management</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.orders.map((order) => (
                      <tr key={order._id}>
                        <td>
                          <strong>{order.number}</strong>
                          <small>
                            {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                          </small>
                        </td>
                        <td>
                          {order.customer?.name || order.shipping.name}
                          <small>{order.customer?.email}</small>
                        </td>
                        <td>
                          {currency(order.total)}
                          {order.payableTotal !== order.total && (
                            <small>Payable {currency(order.payableTotal)}</small>
                          )}
                          {order.refundedTotal > 0 && (
                            <small>Refunded {currency(order.refundedTotal)}</small>
                          )}
                        </td>
                        <td>
                          <div className="badges">
                            {order.fulfillments.map((f) => (
                              <Badge key={getId(f.business)}>{f.status}</Badge>
                            ))}
                            {order.refunds.map((r) => (
                              <span className="badge refund-label" key={r._id}>
                                Refund {r.status}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          {new Date(order.createdAt).toLocaleDateString('en-GB', {
                            timeZone: 'Asia/Dhaka',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td>
                          <Link className="text-link" to={'/orders/' + order._id}>
                            {user.role === 'customer' ? 'View' : 'Manage'}{' '}
                            <ArrowUpRight size={15} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No matching orders"
                description="Try another name, date range or status."
              />
            )}
            <nav className="order-pagination" aria-label="Order pages">
              <span>
                {resource.data.total
                  ? (resource.data.page - 1) * resource.data.limit +
                    1 +
                    '–' +
                    Math.min(resource.data.page * resource.data.limit, resource.data.total)
                  : 0}{' '}
                of {resource.data.total} orders
              </span>
              <div>
                <button
                  className="button secondary"
                  disabled={resource.data.page <= 1}
                  onClick={() => changePage(resource.data.page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {resource.data.page} of {resource.data.pages}
                </span>
                <button
                  className="button secondary"
                  disabled={resource.data.page >= resource.data.pages}
                  onClick={() => changePage(resource.data.page + 1)}
                >
                  Next
                </button>
              </div>
            </nav>
          </>
        )}
      </State>
    </main>
  );
}
export function OrderDetail() {
  const { id } = useParams(),
    resource = useResource('/orders/' + id),
    { user } = useApp();
  return (
    <main className="container content">
      <State resource={resource}>
        {resource.data &&
          (() => {
            const { order } = resource.data;
            return (
              <>
                <PageTitle
                  eyebrow="ORDER DETAILS"
                  title={order.number}
                  description={'Placed ' + date(order.createdAt) + ' · Cash on delivery'}
                  action={
                    <Link
                      className="button secondary"
                      to={
                        user.role === 'seller'
                          ? '/seller/orders'
                          : user.role === 'admin'
                            ? '/admin/orders'
                            : '/orders'
                      }
                    >
                      All orders
                    </Link>
                  }
                />
                <div className="order-layout">
                  <div>
                    <section className="panel">
                      <h2>Your items</h2>
                      {order.items.map((item) => (
                        <div className="order-item" key={item.product + ':' + item.variantId}>
                          {item.image ? <img src={item.image} alt={item.name} /> : <Package />}
                          <div>
                            <Link to={'/products/' + item.product}>
                              <strong>{item.name}</strong>
                            </Link>
                            <p className="muted">
                              {item.variantName || 'Standard'} · {item.quantity} ×{' '}
                              {currency(item.price)}
                            </p>
                            {user.role === 'customer' &&
                              order.fulfillments.some(
                                (f) =>
                                  getId(f.business) === item.business && f.status === 'delivered',
                              ) && (
                                <Link className="text-link" to={'/products/' + item.product}>
                                  Leave a review ↗
                                </Link>
                              )}
                          </div>
                          <strong>{currency(item.price * item.quantity - item.discount)}</strong>
                        </div>
                      ))}
                    </section>
                    {order.fulfillments.map((f) => (
                      <section className="panel tracking" key={getId(f.business)}>
                        <div className="section-heading">
                          <h2>{f.business.name || 'Store'} delivery</h2>
                          <Badge>{f.status}</Badge>
                        </div>
                        {f.trackingNumber && (
                          <p>
                            Tracking reference: <strong>{f.trackingNumber}</strong>
                          </p>
                        )}
                        <ol className="timeline">
                          {f.events.map((event, index) => (
                            <li key={index}>
                              <span className="timeline-dot">
                                {event.status === 'delivered' ? (
                                  <CheckCircle2 size={17} />
                                ) : event.status === 'shipped' ? (
                                  <Truck size={17} />
                                ) : (
                                  <ShoppingBag size={17} />
                                )}
                              </span>
                              <div>
                                <strong>{event.status}</strong>
                                <small>{new Date(event.at).toLocaleString()}</small>
                              </div>
                            </li>
                          ))}
                        </ol>
                        {user.role === 'customer' && f.status === 'placed' && (
                          <Action
                            confirm="Cancel this store's unconfirmed items?"
                            onClick={async () => {
                              await api('/orders/' + id + '/status', {
                                method: 'PATCH',
                                body: { business: getId(f.business), status: 'cancelled' },
                              });
                              resource.reload();
                            }}
                          >
                            Cancel these items
                          </Action>
                        )}
                        {['seller', 'admin'].includes(user.role) &&
                          transitions[f.status].length > 0 && (
                            <Form
                              key={f.status}
                              submit="Update order"
                              success="Order status updated"
                              onSubmit={async (values) => {
                                await api('/orders/' + id + '/status', {
                                  method: 'PATCH',
                                  body: { ...values, business: getId(f.business) },
                                });
                                resource.reload();
                              }}
                            >
                              <div className="form-grid">
                                <Select label="Next status" name="status">
                                  {transitions[f.status].map((value) => (
                                    <option key={value} value={value}>
                                      {value}
                                    </option>
                                  ))}
                                </Select>
                                <Field
                                  label="Tracking reference (optional)"
                                  name="trackingNumber"
                                  maxLength={100}
                                  defaultValue={f.trackingNumber}
                                />
                              </div>
                            </Form>
                          )}
                      </section>
                    ))}
                    <OrderRefunds order={order} user={user} reload={resource.reload} />
                  </div>
                  <aside>
                    <section className="panel">
                      <h2>Payment summary</h2>
                      <div className="summary-row">
                        <span>Subtotal</span>
                        <strong>{currency(order.subtotal)}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Discount {order.couponCode}</span>
                        <strong>−{currency(order.discount)}</strong>
                      </div>
                      <div className="summary-row total">
                        <span>Order total</span>
                        <strong>{currency(order.total)}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Payable after cancellations</span>
                        <strong>{currency(order.payableTotal ?? order.total)}</strong>
                      </div>
                      {order.refundedTotal > 0 && (
                        <div className="summary-row">
                          <span>Refunds paid</span>
                          <strong>{currency(order.refundedTotal)}</strong>
                        </div>
                      )}
                      <p className="muted">
                        Payment is collected on delivery for the items delivered. Cancelled store
                        items are not payable.
                      </p>
                    </section>
                    <section className="panel">
                      <h2>Delivery address</h2>
                      <p>
                        <strong>{order.shipping.name}</strong>
                      </p>
                      <p>
                        {order.shipping.address}
                        <br />
                        {order.shipping.city} {order.shipping.postalCode}
                      </p>
                      <p className="muted">{order.shipping.phone}</p>
                    </section>
                  </aside>
                </div>
              </>
            );
          })()}
      </State>
    </main>
  );
}
export function CustomerDashboard() {
  const resource = useResource('/orders'),
    { user } = useApp();
  return (
    <main className="container content">
      <PageTitle
        eyebrow="YOUR PERSONAL SPACE"
        title={'Welcome, ' + user.name.split(' ')[0] + '.'}
        description="Discover something new. Keep your favorites close."
        action={
          <Link to="/marketplace" className="button primary">
            Explore marketplace <ArrowUpRight size={17} />
          </Link>
        }
      />
      <State resource={resource}>
        {resource.data && (
          <>
            <div className="stats-grid">
              <div className="stat">
                <ShoppingBag />
                <span>Total orders</span>
                <strong>{resource.data.summary.total}</strong>
              </div>
              <div className="stat">
                <Truck />
                <span>In progress</span>
                <strong>{resource.data.summary.inProgress}</strong>
              </div>
              <div className="stat">
                <CheckCircle2 />
                <span>Delivered orders</span>
                <strong>{resource.data.summary.delivered}</strong>
              </div>
            </div>
            <div className="section-heading">
              <h2>Recent orders</h2>
              <Link className="text-link" to="/orders">
                View all ↗
              </Link>
            </div>
            {resource.data.orders.length ? (
              <div className="dashboard-orders">
                {resource.data.orders.slice(0, 5).map((order) => (
                  <Link className="panel" to={'/orders/' + order._id} key={order._id}>
                    <div>
                      <strong>{order.number}</strong>
                      <small>{date(order.createdAt)}</small>
                    </div>
                    <strong>{currency(order.total)}</strong>
                    <ArrowUpRight size={18} />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                title="Your story starts with a discovery."
                description="Your orders and delivery updates will appear here."
                to="/marketplace"
                label="Find something you love"
              />
            )}
          </>
        )}
      </State>
    </main>
  );
}

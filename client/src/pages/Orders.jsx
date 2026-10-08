import { Link, useParams } from 'react-router-dom';
import { Package, CheckCircle2, Truck, ShoppingBag, ArrowUpRight } from 'lucide-react';
import { useApp } from '../context/state';
import { api, currency, date, getId } from '../lib/api';
import { useResource } from '../lib/hooks';
import { State, Empty, PageTitle, Badge, Action, Form, Select, Field } from '../components/UI';
const transitions = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};
export function Orders() {
  const resource = useResource('/orders'),
    { user } = useApp();
  return (
    <main className={user.role === 'customer' ? 'container content' : ''}>
      <PageTitle
        eyebrow={user.role + ' workspace'}
        title="Orders"
        description={
          user.role === 'customer'
            ? 'Every discovery, from checkout to your doorstep.'
            : 'Confirm, prepare and deliver. Keep your customers in the loop.'
        }
      />
      <State resource={resource}>
        {resource.data?.orders.length ? (
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th />
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
                    <td>{order.customer?.name}</td>
                    <td>
                      {currency(order.total)}
                      {order.payableTotal !== order.total && (
                        <small>Payable {currency(order.payableTotal)}</small>
                      )}
                    </td>
                    <td>
                      <div className="badges">
                        {order.fulfillments.map((f) => (
                          <Badge key={getId(f.business)}>{f.status}</Badge>
                        ))}
                      </div>
                    </td>
                    <td>{date(order.createdAt)}</td>
                    <td>
                      <Link className="text-link" to={'/orders/' + order._id}>
                        View <ArrowUpRight size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No orders yet"
            description="Orders will appear here once a customer completes checkout."
          />
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
                <strong>{resource.data.orders.length}</strong>
              </div>
              <div className="stat">
                <Truck />
                <span>In progress</span>
                <strong>
                  {
                    resource.data.orders.filter((order) =>
                      order.fulfillments.some(
                        (f) => !['delivered', 'cancelled'].includes(f.status),
                      ),
                    ).length
                  }
                </strong>
              </div>
              <div className="stat">
                <CheckCircle2 />
                <span>Delivered orders</span>
                <strong>
                  {
                    resource.data.orders.filter(
                      (order) =>
                        order.fulfillments.every((f) =>
                          ['delivered', 'cancelled'].includes(f.status),
                        ) && order.fulfillments.some((f) => f.status === 'delivered'),
                    ).length
                  }
                </strong>
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

import { useSearchParams, Link } from 'react-router-dom';
import { useResource } from '../lib/hooks';
import { currency, date, downloadJson, getId } from '../lib/api';
import { State, PageTitle, Field, Badge, Empty } from '../components/UI';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
export function PlatformAnalytics() {
  const resource = useResource('/admin/statistics');
  return (
    <>
      <PageTitle
        eyebrow="PLATFORM STATISTICS"
        title="Marketplace performance"
        description="Users, stores, sales and marketplace activity from recorded data."
      />
      <State resource={resource}>
        {resource.data &&
          (() => {
            const data = resource.data.statistics;
            return (
              <>
                <div className="stats-grid">
                  {[
                    ['Customers', data.customers],
                    ['Sellers', data.sellers],
                    ['Staff', data.staff],
                    ['Businesses', data.businesses],
                    ['Products', data.products],
                    ['Orders', data.orders],
                    ['Net delivered sales', currency(data.sales)],
                    ['Open reports', data.reports],
                    ['Suspended businesses', data.suspendedBusinesses],
                  ].map(([label, value]) => (
                    <div className="stat" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <section className="panel">
                  <div className="section-heading">
                    <h2>Order activity</h2>
                    <button
                      className="button secondary"
                      onClick={() => downloadJson(data, 'bizlaunch-platform-report.json')}
                    >
                      Export platform report
                    </button>
                  </div>
                  <div style={{ height: 280, width: '100%' }}>
                    <ResponsiveContainer>
                      <BarChart data={data.activity}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar
                          isAnimationActive={false}
                          dataKey="orders"
                          fill="#087f6b"
                          radius={[5, 5, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                <section className="panel table-wrap">
                  <h2>Business performance</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Business</th>
                        <th>Products</th>
                        <th>Orders</th>
                        <th>Refunds paid</th>
                        <th>Net delivered sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.stores.map((store) => (
                        <tr key={store.business}>
                          <td>{store.name}</td>
                          <td>{store.products}</td>
                          <td>{store.orders}</td>
                          <td>{currency(store.refunds)}</td>
                          <td>{currency(store.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </>
            );
          })()}
      </State>
    </>
  );
}
export function Transactions() {
  const [params, setParams] = useSearchParams(),
    resource = useResource('/orders?' + params);
  return (
    <>
      <PageTitle
        eyebrow="COD TRANSACTION MONITORING"
        title="Payments & refunds"
        description="Store-level payment receipts and completed refunds, with links to each order."
      />
      <section className="panel">
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const next = new URLSearchParams();
            for (const [key, value] of new FormData(event.currentTarget))
              if (value) next.set(key, value);
            setParams(next);
          }}
        >
          <Field
            label="Transaction customer / order"
            name="q"
            defaultValue={params.get('q') || ''}
            maxLength={80}
          />
          <Field
            label="Transaction from date"
            name="from"
            type="date"
            defaultValue={params.get('from') || ''}
          />
          <Field
            label="Transaction to date"
            name="to"
            type="date"
            defaultValue={params.get('to') || ''}
          />
          <button className="button primary">Filter transactions</button>
        </form>
        <p className="muted">
          Date filters use order placement in Bangladesh time. Receipt dates appear in each payment
          row.
        </p>
      </section>
      <State resource={resource}>
        {resource.data && (
          <>
            <div className="panel table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order / customer</th>
                    <th>Store</th>
                    <th>COD payment</th>
                    <th>Receipt</th>
                    <th>Paid refunds</th>
                    <th>Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.orders.flatMap((order) =>
                    order.fulfillments.map((f) => (
                      <tr key={order._id + getId(f.business)}>
                        <td>
                          <strong>{order.number}</strong>
                          <small>{order.customer?.name}</small>
                        </td>
                        <td>{f.business.name}</td>
                        <td>
                          <Badge>
                            {f.paymentStatus === 'paid'
                              ? 'Collected'
                              : f.status === 'cancelled'
                                ? 'Cancelled'
                                : 'Unrecorded'}
                          </Badge>
                          <small>{currency(f.collectedAmount || 0)}</small>
                        </td>
                        <td>
                          {f.paymentReference || '—'}
                          <small>{f.paidAt ? date(f.paidAt) : ''}</small>
                        </td>
                        <td>
                          {currency(
                            order.refunds
                              .filter(
                                (r) =>
                                  getId(r.business) === getId(f.business) &&
                                  r.status === 'completed',
                              )
                              .reduce((sum, r) => sum + r.amount, 0),
                          )}
                        </td>
                        <td>
                          <Link className="text-link" to={'/orders/' + order._id}>
                            Open order ↗
                          </Link>
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
              {!resource.data.total && <Empty title="No matching transactions" />}
            </div>
            <div className="order-pagination">
              <span>{resource.data.total} matching orders</span>
              <div>
                <button
                  className="button secondary"
                  disabled={resource.data.page <= 1}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', resource.data.page - 1);
                    setParams(next);
                  }}
                >
                  Previous
                </button>
                <span>
                  Page {resource.data.page} of {resource.data.pages}
                </span>
                <button
                  className="button secondary"
                  disabled={resource.data.page >= resource.data.pages}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', resource.data.page + 1);
                    setParams(next);
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </State>
    </>
  );
}

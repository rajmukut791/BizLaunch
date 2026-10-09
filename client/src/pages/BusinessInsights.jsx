import { useSearchParams } from 'react-router-dom';
import { useResource } from '../lib/hooks';
import { currency, downloadJson } from '../lib/api';
import { State, Form, Field, Empty } from '../components/UI';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
export default function BusinessInsights() {
  const [params, setParams] = useSearchParams(),
    resource = useResource('/seller/insights?' + params);
  return (
    <>
      <section className="panel">
        <h2>Sales explorer</h2>
        <Form
          submit="Explore date range"
          onSubmit={(values) => {
            const next = new URLSearchParams();
            for (const [k, v] of Object.entries(values)) if (v) next.set(k, v);
            setParams(next);
          }}
        >
          <div className="form-grid">
            <Field
              label="Sales from date"
              name="from"
              type="date"
              defaultValue={params.get('from') || ''}
            />
            <Field
              label="Sales to date"
              name="to"
              type="date"
              defaultValue={params.get('to') || ''}
            />
          </div>
        </Form>
      </section>
      <State resource={resource}>
        {resource.data &&
          (() => {
            const data = resource.data.insights;
            return (
              <>
                <div className="stats-grid">
                  {[
                    ['Today’s sales', currency(data.today.revenue)],
                    ['Today’s orders', data.today.orders],
                    ['Today’s estimated profit', currency(data.today.profit)],
                    ['Repeat buyers in range', data.customers.repeat],
                  ].map(([label, value]) => (
                    <div className="stat" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <section className="panel">
                  <div className="section-heading">
                    <h2>Business insights</h2>
                    <button
                      className="button secondary small"
                      onClick={() => downloadJson(data, 'bizlaunch-sales-insights.json')}
                    >
                      Export range
                    </button>
                  </div>
                  {data.insights.map((message) => (
                    <p className="info-box" key={message}>
                      {message}
                    </p>
                  ))}
                  <p className="muted">{data.recognition}</p>
                </section>
                {[
                  ['Daily performance', data.daily],
                  ['Weekly performance', data.weekly],
                ].map(([title, rows]) => (
                  <section className="panel" key={title}>
                    <h2>{title}</h2>
                    <p className="muted">
                      {data.range.from} — {data.range.to} · Bangladesh time
                    </p>
                    <div style={{ height: 280, width: '100%' }}>
                      <ResponsiveContainer>
                        <BarChart data={rows}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(value) => currency(value)} />
                          <Legend />
                          <Bar
                            dataKey="revenue"
                            name="Net revenue"
                            fill="#087f6b"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="profit"
                            name="Estimated profit"
                            fill="#c6d6ad"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                ))}
                <div className="dashboard-grid">
                  <section className="panel">
                    <h2>Best-selling products</h2>
                    {data.topProducts.length ? (
                      data.topProducts.map((p) => (
                        <div className="summary-row" key={p.product}>
                          <span>
                            {p.name}
                            <small>{p.quantity} units delivered</small>
                          </span>
                          <strong>{currency(p.revenue)}</strong>
                        </div>
                      ))
                    ) : (
                      <Empty title="No delivered sales in this range" />
                    )}
                  </section>
                  <section className="panel">
                    <h2>Expense breakdown</h2>
                    {data.expenseBreakdown.map((row) => (
                      <div className="summary-row" key={row.category}>
                        <span>{row.category.replaceAll('_', ' ')}</span>
                        <strong>{currency(row.amount)}</strong>
                      </div>
                    ))}
                    {!data.expenseBreakdown.length && (
                      <p className="muted">No expenses recorded in this range.</p>
                    )}
                  </section>
                </div>
                <section className="panel">
                  <h2>Slow-moving inventory</h2>
                  <p className="muted">
                    Stocked active products with no delivered sales for at least 30 days.
                  </p>
                  {data.slowMoving.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Stock</th>
                            <th>Last delivery</th>
                            <th>Days without sales</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.slowMoving.map((p) => (
                            <tr key={p.product}>
                              <td>{p.name}</td>
                              <td>{p.stock}</td>
                              <td>
                                {p.lastSale
                                  ? new Date(p.lastSale).toLocaleDateString('en-GB')
                                  : 'No delivered sales'}
                              </td>
                              <td>{p.days}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted">No slow-moving products at present.</p>
                  )}
                </section>
              </>
            );
          })()}
      </State>
    </>
  );
}

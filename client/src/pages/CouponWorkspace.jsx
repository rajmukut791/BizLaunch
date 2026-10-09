import { useState } from 'react';
import { api, currency, date } from '../lib/api';
import { useResource } from '../lib/hooks';
import { PageTitle, State, Form, Field, Select, Action, Badge, Empty } from '../components/UI';
const local = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export default function CouponWorkspace() {
  const [now] = useState(() => Date.now());
  const resource = useResource('/seller/coupons'),
    [editing, setEditing] = useState(null),
    [type, setType] = useState('percentage');
  return (
    <>
      <PageTitle
        eyebrow="THOUGHTFUL OFFERS"
        title="Coupons"
        description="Percentage or fixed discounts, scheduled starts and protected usage limits."
      />
      <section className="panel">
        <div className="section-heading">
          <h2>{editing ? 'Edit unused coupon' : 'Create a coupon'}</h2>
          {editing && (
            <button
              className="button secondary"
              onClick={() => {
                setEditing(null);
                setType('percentage');
              }}
            >
              Close editor
            </button>
          )}
        </div>
        <Form
          key={editing?._id || 'new'}
          submit={editing ? 'Save coupon' : 'Create coupon'}
          success="Coupon saved"
          onSubmit={async (values, form) => {
            await api('/seller/coupons' + (editing ? '/' + editing._id : ''), {
              method: editing ? 'PATCH' : 'POST',
              body: {
                ...values,
                discountType: type,
                discountValue: Number(values.discountValue),
                minimum: Number(values.minimum),
                limit: Number(values.limit),
                startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : undefined,
                expiresAt: new Date(values.expiresAt).toISOString(),
                ...(editing ? { version: editing.__v } : {}),
              },
            });
            setEditing(null);
            form.reset();
            resource.reload();
          }}
        >
          <div className="form-grid">
            <Field
              label="Code"
              name="code"
              defaultValue={editing?.code}
              required
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_-]+"
            />
            <Select label="Discount type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="percentage">Percentage discount</option>
              <option value="fixed">Fixed amount in BDT</option>
            </Select>
            <Field
              label={type === 'percentage' ? 'Discount (%)' : 'Discount amount (BDT)'}
              name="discountValue"
              type="number"
              min={type === 'percentage' ? 1 : 0.01}
              max={type === 'percentage' ? 80 : 1000000}
              step={type === 'percentage' ? 1 : 0.01}
              defaultValue={editing?.discountValue || editing?.percent}
              required
            />
            <Field
              label="Minimum order (BDT)"
              name="minimum"
              type="number"
              min={0}
              step="0.01"
              defaultValue={editing?.minimum || 0}
              required
            />
            <Field
              label="Starts at (optional)"
              name="startsAt"
              type="datetime-local"
              defaultValue={
                editing?.startsAt && new Date(editing.startsAt).getTime() > 0
                  ? local(editing.startsAt)
                  : ''
              }
            />
            <Field
              label="Expires at"
              name="expiresAt"
              type="datetime-local"
              defaultValue={local(editing?.expiresAt)}
              required
            />
            <Field
              label="Usage limit"
              name="limit"
              type="number"
              min={1}
              max={1000000}
              step={1}
              defaultValue={editing?.limit || 100}
              required
            />
          </div>
        </Form>
        <p className="muted">
          Terms can be edited or deleted until first use. Existing orders retain their original
          discounts.
        </p>
      </section>
      <State resource={resource}>
        {resource.data?.coupons.length ? (
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Minimum</th>
                  <th>Used</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.coupons.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <strong>{c.code}</strong>
                    </td>
                    <td>
                      {c.discountType === 'fixed'
                        ? currency(c.discountValue)
                        : (c.discountValue || c.percent) + '%'}
                    </td>
                    <td>{currency(c.minimum)}</td>
                    <td>
                      {c.used} / {c.limit}
                    </td>
                    <td>
                      {c.startsAt && new Date(c.startsAt).getTime() > 0 && (
                        <small>From {date(c.startsAt)}</small>
                      )}
                      {date(c.expiresAt)}
                    </td>
                    <td>
                      <Badge>
                        {new Date(c.expiresAt).getTime() < now
                          ? 'expired'
                          : !c.active
                            ? 'disabled'
                            : new Date(c.startsAt).getTime() > now
                              ? 'scheduled'
                              : 'active'}
                      </Badge>
                    </td>
                    <td>
                      <Action
                        onClick={async () => {
                          await api('/seller/coupons/' + c._id, {
                            method: 'PATCH',
                            body: { active: !c.active },
                          });
                          resource.reload();
                        }}
                      >
                        {c.active ? 'Disable' : 'Enable'}
                      </Action>
                      {!c.used && (
                        <>
                          <button
                            className="button secondary small"
                            onClick={() => {
                              setEditing(c);
                              setType(c.discountType || 'percentage');
                              window.scrollTo(0, 0);
                            }}
                          >
                            Edit coupon
                          </button>
                          <Action
                            confirm="Delete this unused coupon?"
                            onClick={async () => {
                              await api('/seller/coupons/' + c._id, { method: 'DELETE' });
                              resource.reload();
                            }}
                          >
                            Delete coupon
                          </Action>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Your first offer starts here" />
        )}
      </State>
    </>
  );
}
export function ExpenseEditor({ expense, reload }) {
  return (
    <details>
      <summary>Edit expense</summary>
      <Form
        key={expense.updatedAt}
        submit="Save expense"
        success="Expense updated"
        onSubmit={async (values) => {
          await api('/seller/expenses/' + expense._id, {
            method: 'PATCH',
            body: { ...values, amount: Number(values.amount) },
          });
          reload();
        }}
      >
        <Field
          label="Expense title"
          name="title"
          defaultValue={expense.title}
          required
          minLength={2}
          maxLength={120}
        />
        <Field
          label="Expense amount"
          name="amount"
          type="number"
          min={0.01}
          step="0.01"
          defaultValue={expense.amount}
          required
        />
        <Field
          label="Expense date"
          name="date"
          type="date"
          defaultValue={new Date(expense.date).toISOString().slice(0, 10)}
          required
        />
        <Select label="Expense category" name="category" defaultValue={expense.category}>
          {[
            'rent',
            'marketing',
            'utilities',
            'salary',
            'shipping',
            'packaging',
            'product_purchase',
            'other',
          ].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </Select>
        <Field label="Expense note" name="note" defaultValue={expense.note} maxLength={1000} />
      </Form>
    </details>
  );
}

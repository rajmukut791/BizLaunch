import { currency, getId, api } from '../lib/api';
import { Badge, Form, Field, Select, Textarea } from '../components/UI';
export function OrderRefunds({ order, user, reload }) {
  return (
    <section className="panel order-refunds">
      <div className="section-heading">
        <h2>Refund management</h2>
        <span className="badge">Admin reviewed</span>
      </div>
      <p className="muted">
        Refunds are available after delivery. Cash-on-delivery payments are returned outside
        BizLaunch; an administrator records the payout here. A refund does not automatically return
        stock.
      </p>
      {order.fulfillments.map((f) => {
        const business = getId(f.business),
          refund = order.refunds.find((r) => getId(r.business) === business);
        const maximum = order.items
          .filter((item) => getId(item.business) === business)
          .reduce((sum, item) => sum + item.price * item.quantity - item.discount, 0);
        return (
          <article className="refund-case" key={business}>
            <h3>{f.business.name || 'Store'}</h3>
            {refund ? (
              <>
                <div className="section-heading">
                  <strong>{currency(refund.amount)}</strong>
                  <Badge>{refund.status}</Badge>
                </div>
                <p>{refund.reason}</p>
                <ol className="refund-history">
                  {refund.events.map((event, index) => (
                    <li key={index}>
                      <strong>{event.status}</strong>
                      <small>
                        {new Date(event.at).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}
                      </small>
                      <p>{event.note}</p>
                    </li>
                  ))}
                </ol>
                {refund.status === 'completed' && (
                  <p className="refund-paid">
                    Payout recorded · {refund.payoutMethod.replaceAll('_', ' ')} ·{' '}
                    {refund.payoutReference}
                  </p>
                )}
                {user.role === 'admin' && ['requested', 'approved'].includes(refund.status) && (
                  <Form
                    key={refund.version}
                    submit={
                      refund.status === 'approved' ? 'Record refund payout' : 'Save refund decision'
                    }
                    success="Refund updated"
                    onSubmit={async (values) => {
                      const completed = refund.status === 'approved';
                      if (
                        completed &&
                        !window.confirm(
                          'Confirm that this refund has already been paid to the customer?',
                        )
                      )
                        return false;
                      await api('/orders/' + order._id + '/refunds/' + refund._id, {
                        method: 'PATCH',
                        body: {
                          ...values,
                          status: completed ? 'completed' : values.status,
                          version: refund.version,
                          paymentConfirmed: values.paymentConfirmed === 'on',
                        },
                      });
                      reload();
                    }}
                  >
                    {refund.status === 'requested' ? (
                      <Select label="Refund decision" name="status">
                        <option value="approved">Approve refund</option>
                        <option value="rejected">Reject refund</option>
                      </Select>
                    ) : (
                      <>
                        <p className="muted">
                          Transfer the approved amount first, then record the actual payment.
                        </p>
                        <Select label="Payout method" name="payoutMethod">
                          <option value="cash">Cash</option>
                          <option value="bank_transfer">Bank transfer</option>
                          <option value="mobile_banking">Mobile banking</option>
                        </Select>
                        <Field
                          label="Payout reference / receipt"
                          name="payoutReference"
                          required
                          minLength={5}
                          maxLength={120}
                        />
                        <label className="refund-confirm">
                          <input name="paymentConfirmed" type="checkbox" required /> I confirm{' '}
                          {currency(refund.amount)} has been paid to the customer.
                        </label>
                      </>
                    )}
                    <Textarea
                      label="Review note"
                      name="note"
                      required
                      minLength={5}
                      maxLength={1000}
                    />
                  </Form>
                )}
              </>
            ) : ['delivered', 'returned'].includes(f.status) &&
              f.paymentStatus === 'paid' &&
              ['customer', 'admin'].includes(user.role) ? (
              <details>
                <summary>Request a refund</summary>
                <p className="muted">
                  Up to {currency(maximum)}. One refund case per store in this order.
                </p>
                <Form
                  submit="Submit refund request"
                  success="Refund request submitted"
                  onSubmit={async (values) => {
                    await api('/orders/' + order._id + '/refunds', {
                      method: 'POST',
                      body: { ...values, business, amount: Number(values.amount) },
                    });
                    reload();
                  }}
                >
                  <Field
                    label="Refund amount (BDT)"
                    type="number"
                    name="amount"
                    required
                    min={0.01}
                    max={maximum.toFixed(2)}
                    step="0.01"
                    defaultValue={maximum.toFixed(2)}
                  />
                  <Textarea
                    label="Refund reason"
                    name="reason"
                    required
                    minLength={10}
                    maxLength={1000}
                  />
                </Form>
              </details>
            ) : (
              <p className="muted">
                {f.status === 'delivered'
                  ? 'No refund requested.'
                  : 'Refunds become available when this store’s items are delivered.'}
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}

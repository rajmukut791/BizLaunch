import { api, getId } from '../lib/api';
import { Form, Field, Select, Textarea, Badge } from '../components/UI';
export default function OrderReturns({ order, user, reload }) {
  return (
    <section className="panel">
      <h2>Returns & inspection</h2>
      <p className="muted">
        A return covers all items from one store in this order. The seller reviews it, confirms
        physical receipt, then decides whether inspected stock can be resold. Refunds are managed
        separately below.
      </p>
      {order.fulfillments.map((f) => {
        const business = getId(f.business),
          entry = order.returns.find((r) => getId(r.business) === business);
        return (
          <article className="refund-case" key={business}>
            <h3>{f.business.name || 'Store'}</h3>
            {entry ? (
              <>
                <Badge>{entry.status}</Badge>
                <p>{entry.reason}</p>
                <ol className="refund-history">
                  {entry.events.map((event, index) => (
                    <li key={index}>
                      <strong>{event.status}</strong>
                      <p>{event.note}</p>
                      <small>
                        {new Date(event.at).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}
                      </small>
                    </li>
                  ))}
                </ol>
                {entry.status === 'received' && (
                  <p className="info-box">
                    {entry.restock
                      ? 'Returned stock inspected and restored.'
                      : 'Received items are not suitable for restocking.'}
                  </p>
                )}
                {['seller', 'staff', 'admin'].includes(user.role) &&
                  ['requested', 'approved'].includes(entry.status) && (
                    <Form
                      key={entry.version}
                      submit={
                        entry.status === 'approved'
                          ? 'Confirm return receipt'
                          : 'Save return decision'
                      }
                      success="Return updated"
                      onSubmit={async (values) => {
                        if (
                          entry.status === 'approved' &&
                          !window.confirm(
                            'Confirm that all store items have physically arrived and been inspected?',
                          )
                        )
                          return false;
                        await api('/orders/' + order._id + '/returns/' + entry._id, {
                          method: 'PATCH',
                          body: {
                            ...values,
                            status: entry.status === 'approved' ? 'received' : values.status,
                            version: entry.version,
                            receivedConfirmed: values.receivedConfirmed === 'on',
                            restock: values.restock === 'true',
                          },
                        });
                        reload();
                      }}
                    >
                      {entry.status === 'requested' ? (
                        <Select label="Return decision" name="status">
                          <option value="approved">Approve return</option>
                          <option value="rejected">Reject return</option>
                        </Select>
                      ) : (
                        <>
                          <Select label="Inspection outcome" name="restock">
                            <option value="false">Do not restock damaged / unusable items</option>
                            <option value="true">
                              All items inspected and suitable for resale
                            </option>
                          </Select>
                          <label className="refund-confirm">
                            <input type="checkbox" name="receivedConfirmed" required /> All items
                            from this store have been physically received.
                          </label>
                        </>
                      )}
                      <Textarea
                        label="Return review note"
                        name="note"
                        required
                        minLength={5}
                        maxLength={1000}
                      />
                    </Form>
                  )}
              </>
            ) : f.status === 'delivered' ? (
              <details>
                <summary>Request store return</summary>
                <Form
                  submit="Submit return request"
                  success="Return request submitted"
                  onSubmit={async (values) => {
                    await api('/orders/' + order._id + '/returns', {
                      method: 'POST',
                      body: { ...values, business },
                    });
                    reload();
                  }}
                >
                  <Field
                    label="Return reason"
                    name="reason"
                    required
                    minLength={10}
                    maxLength={1000}
                  />
                </Form>
              </details>
            ) : (
              <p className="muted">Return requests are available after delivery.</p>
            )}
          </article>
        );
      })}
    </section>
  );
}

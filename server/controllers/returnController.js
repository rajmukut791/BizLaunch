const { Order, Business } = require('../models/commerce');
const { fail, id, text, number, oneOf } = require('../utils/validation');
const { ownedBusiness, notify } = require('../services/commerce');
const { atomic, restore } = require('./checkoutController');
const same = (a, b) => String(a) === String(b);
async function access(req, order, business) {
  if (req.user.role === 'customer' && !same(order.customer, req.user.id))
    fail(403, 'Order belongs to another customer');
  if (req.user.role === 'seller' && !same((await ownedBusiness(req.user))._id, business))
    fail(403, 'Order belongs to another store');
}
exports.request = async (req, res) => {
  const order = await Order.findById(id(req.params.id)),
    business = id(req.body?.business);
  if (!order) fail(404, 'Order not found');
  await access(req, order, business);
  const reason = text(req.body?.reason, 'Return reason', 10, 1000);
  if (!order.fulfillments.some((f) => same(f.business, business) && f.status === 'delivered'))
    fail(400, 'Only delivered items can be returned');
  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      'returns.business': { $ne: business },
      fulfillments: { $elemMatch: { business, status: 'delivered' } },
    },
    {
      $push: {
        returns: {
          business,
          reason,
          status: 'requested',
          version: 0,
          requestedAt: new Date(),
          events: [{ status: 'requested', note: reason, actor: req.user._id, at: new Date() }],
        },
      },
    },
    { returnDocument: 'after', runValidators: true },
  );
  if (!updated) fail(409, 'This store already has a return case');
  await notify(
    order.customer,
    'Return requested',
    order.number + ' return is awaiting review.',
    '/orders/' + order.id,
  );
  const store = await Business.findById(business);
  await notify(
    store.owner,
    'Return requested',
    order.number + ' has a return case to review.',
    '/orders/' + order.id,
  );
  res.status(201).json({ success: true, message: 'Return request submitted' });
};
exports.review = async (req, res) => {
  const orderId = id(req.params.id),
    returnId = id(req.params.returnId),
    status = oneOf(req.body?.status, ['approved', 'rejected', 'received'], 'return status'),
    note = text(req.body?.note, 'Inspection note', 5, 1000),
    version = number(req.body?.version, 'Return version', 0, 100000, true);
  await atomic(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) fail(404, 'Order not found');
    const entry = order.returns.id(returnId);
    if (!entry) fail(404, 'Return case not found');
    await access(req, order, entry.business);
    if (
      !{ requested: ['approved', 'rejected'], approved: ['received'], received: [], rejected: [] }[
        entry.status
      ].includes(status)
    )
      fail(409, 'Invalid return transition');
    const update = { 'returns.$[r].status': status, 'returns.$[r].updatedAt': new Date() },
      received = status === 'received';
    if (received) {
      if (req.body?.receivedConfirmed !== true || typeof req.body?.restock !== 'boolean')
        fail(400, 'Confirm physical receipt and choose the stock inspection result');
      update['returns.$[r].receivedAt'] = new Date();
      update['returns.$[r].restock'] = req.body.restock;
      update['fulfillments.$[f].status'] = 'returned';
    }
    const saved = await Order.findOneAndUpdate(
      { _id: orderId, returns: { $elemMatch: { _id: entry._id, status: entry.status, version } } },
      {
        $set: update,
        $inc: { 'returns.$[r].version': 1 },
        $push: {
          'returns.$[r].events': { status, note, actor: req.user._id, at: new Date() },
          ...(received
            ? { 'fulfillments.$[f].events': { status: 'returned', at: new Date() } }
            : {}),
        },
      },
      {
        session,
        returnDocument: 'after',
        runValidators: true,
        arrayFilters: [
          { 'r._id': entry._id },
          ...(received ? [{ 'f.business': entry.business }] : []),
        ],
      },
    );
    if (!saved) fail(409, 'Return changed. Reload before reviewing');
    if (received && req.body.restock)
      for (const item of order.items.filter((i) => same(i.business, entry.business)))
        await restore(
          { ...item.toObject(), reference: order.number + ' inspected return' },
          session,
        );
  });
  const order = await Order.findById(orderId),
    entry = order.returns.id(returnId),
    store = await Business.findById(entry.business);
  await notify(
    order.customer,
    'Return ' + status,
    order.number + ': ' + note,
    '/orders/' + order.id,
  );
  await notify(store.owner, 'Return ' + status, order.number + ': ' + note, '/orders/' + order.id);
  res.json({ success: true, message: 'Return updated' });
};

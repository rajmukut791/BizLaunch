const { Order, Business } = require('../models/commerce');
const { fail, id, text, number, money, oneOf } = require('../utils/validation');
const { notify } = require('../services/commerce');
const same = (a, b) => String(a) === String(b);
exports.request = async (req, res) => {
  if (!['customer', 'admin'].includes(req.user.role))
    fail(403, 'Only the customer or an administrator can request a refund');
  const orderId = id(req.params.id),
    business = id(req.body?.business);
  const reason = text(req.body?.reason, 'Refund reason', 10, 1000);
  const order = await Order.findById(orderId);
  if (!order) fail(404, 'Order not found');
  if (req.user.role === 'customer' && !same(order.customer, req.user.id))
    fail(403, 'Order belongs to another customer');
  const fulfillment = order.fulfillments.find((f) => same(f.business, business));
  if (!fulfillment || !['delivered', 'returned'].includes(fulfillment.status))
    fail(400, 'Refunds are available only for delivered store items');
  if (fulfillment.paymentStatus !== 'paid')
    fail(400, 'Record the collected COD payment before requesting a refund');
  const maximum = money(
    order.items
      .filter((item) => same(item.business, business))
      .reduce((sum, item) => sum + item.price * item.quantity - item.discount, 0),
  );
  const amount = number(req.body?.amount, 'Refund amount', 0.01, maximum);
  const refund = {
    business,
    amount,
    reason,
    status: 'requested',
    version: 0,
    requestedAt: new Date(),
    events: [{ status: 'requested', note: reason, actor: req.user._id, at: new Date() }],
  };
  const updated = await Order.findOneAndUpdate(
    {
      _id: orderId,
      'refunds.business': { $ne: business },
      fulfillments: { $elemMatch: { business, status: { $in: ['delivered', 'returned'] } } },
    },
    { $push: { refunds: refund } },
    { returnDocument: 'after', runValidators: true },
  );
  if (!updated) fail(409, 'This store already has a refund case. Open the existing case.');
  await notify(
    order.customer,
    'Refund request received',
    order.number + ' refund is awaiting admin review.',
    '/orders/' + orderId,
  );
  const store = await Business.findById(business);
  if (store)
    await notify(
      store.owner,
      'Refund requested',
      order.number + ' has a refund request under admin review.',
      '/orders/' + orderId,
    );
  res.status(201).json({ success: true, message: 'Refund request submitted for admin review' });
};
exports.review = async (req, res) => {
  const orderId = id(req.params.id),
    refundId = id(req.params.refundId);
  const status = oneOf(req.body?.status, ['approved', 'rejected', 'completed'], 'refund status');
  const note = text(req.body?.note, 'Review note', 5, 1000);
  const version = number(req.body?.version, 'Refund version', 0, 100000, true);
  const order = await Order.findById(orderId);
  if (!order) fail(404, 'Order not found');
  const refund = order.refunds.id(refundId);
  if (!refund) fail(404, 'Refund case not found');
  const allowed = {
    requested: ['approved', 'rejected'],
    approved: ['completed'],
    rejected: [],
    completed: [],
  };
  if (!allowed[refund.status].includes(status))
    fail(409, 'This refund cannot move to the selected status');
  const update = { 'refunds.$.status': status, 'refunds.$.updatedAt': new Date() };
  if (status === 'completed') {
    if (req.body?.paymentConfirmed !== true)
      fail(400, 'Confirm that the refund has actually been paid');
    update['refunds.$.payoutMethod'] = oneOf(
      req.body?.payoutMethod,
      ['cash', 'bank_transfer', 'mobile_banking'],
      'payout method',
    );
    update['refunds.$.payoutReference'] = text(
      req.body?.payoutReference,
      'Payout reference',
      5,
      120,
    );
    update['refunds.$.completedAt'] = new Date();
  }
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, refunds: { $elemMatch: { _id: refundId, status: refund.status, version } } },
    {
      $set: update,
      $inc: { 'refunds.$.version': 1 },
      $push: { 'refunds.$.events': { status, note, actor: req.user._id, at: new Date() } },
    },
    { returnDocument: 'after', runValidators: true },
  );
  if (!updated) fail(409, 'Refund changed. Reload before reviewing.');
  await notify(
    order.customer,
    'Refund ' + status,
    order.number + ': ' + note,
    '/orders/' + orderId,
  );
  const store = await Business.findById(refund.business);
  if (store)
    await notify(store.owner, 'Refund ' + status, order.number + ': ' + note, '/orders/' + orderId);
  res.json({
    success: true,
    message: status === 'completed' ? 'Refund payout recorded' : 'Refund review saved',
  });
};

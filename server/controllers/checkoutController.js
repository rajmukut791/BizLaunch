const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const { Business, Product, Order, Coupon, CheckoutLock } = require('../models/commerce');
const { fail, text, number, id, oneOf, money } = require('../utils/validation');
const { ownedBusiness, notify } = require('../services/commerce');
const quote = require('../services/quote');
const same = (a, b) => String(a) === String(b);

// Replica sets use database transactions. Standalone MongoDB is supported for local
// development using atomic stock updates and compensation on request failures.
async function atomic(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } catch (error) {
      if (error.code !== 20 && error.codeName !== 'IllegalOperation') throw error;
      if (process.env.NODE_ENV === 'production')
        fail(503, 'Checkout requires a MongoDB replica set in production');
      return await work(null);
    }
  } finally {
    await session.endSession();
  }
}
async function reserve(item, session) {
  const query = { _id: item.product, active: true, __v: item.version };
  let update;
  if (item.variantId) {
    query.variants = { $elemMatch: { _id: item.variantId, stock: { $gte: item.quantity } } };
    update = { $inc: { 'variants.$.stock': -item.quantity, __v: 1 } };
  } else {
    query.stock = { $gte: item.quantity };
    query['variants.0'] = { $exists: false };
    update = { $inc: { stock: -item.quantity, __v: 1 } };
  }
  const product = await Product.findOneAndUpdate(query, update, {
    returnDocument: 'after',
    session,
  });
  if (!product) fail(409, item.name + ' has insufficient stock. Refresh your cart');
}
async function restore(item, session) {
  if (item.variantId) {
    const restored = await Product.updateOne(
      { _id: item.product, 'variants._id': item.variantId },
      { $inc: { 'variants.$.stock': item.quantity, __v: 1 } },
      { session },
    );
    if (!restored.matchedCount) throw new Error('Could not restore removed variant inventory');
  } else {
    await Product.updateOne(
      { _id: item.product },
      { $inc: { stock: item.quantity, __v: 1 } },
      { session },
    );
  }
}
exports.placeOrder = async (req, res) => {
  const body = req.body || {};
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50)
    fail(400, 'Cart must contain 1–50 items');
  const checkoutKey = text(req.get('Idempotency-Key'), 'Checkout key', 8, 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(checkoutKey)) fail(400, 'Invalid checkout key');
  const shipping = {};
  for (const [key, min, max] of [
    ['name', 2, 80],
    ['phone', 5, 30],
    ['address', 5, 300],
    ['city', 2, 80],
    ['postalCode', 0, 20],
  ])
    shipping[key] = text(body.shipping?.[key] || '', key, min, max);
  if (body.paymentMethod !== 'cod') fail(400, 'Cash on delivery is the supported payment method');
  const duplicate = await Order.findOne({ customer: req.user.id, checkoutKey });
  if (duplicate) {
    const order = duplicate.toObject();
    order.items.forEach((item) => delete item.cost);
    delete order.checkoutKey;
    return res.json({ success: true, order });
  }
  let placed;
  try {
    placed = await atomic(async (session) => {
      const reserved = [];
      let coupon, lock, committedOrder;
      try {
        const existing = await Order.findOne({ customer: req.user.id, checkoutKey }).session(
          session,
        );
        if (existing) return existing;
        [lock] = await CheckoutLock.create([{ customer: req.user.id, key: checkoutKey }], {
          session,
        });
        const calculation = await quote(body, session);
        const { lines, subtotal } = calculation;
        if (
          body.expectedTotal !== undefined &&
          number(body.expectedTotal, 'Expected total') !== calculation.total
        )
          fail(409, 'Prices changed. Review your order again');
        if (calculation.coupon) {
          const found = calculation.coupon;
          const claimed = await Coupon.updateOne(
            {
              _id: found._id,
              active: true,
              expiresAt: { $gt: new Date() },
              $expr: { $lt: ['$used', '$limit'] },
            },
            { $inc: { used: 1 } },
            { session },
          );
          if (!claimed.modifiedCount) fail(409, 'Coupon was just used up');
          coupon = { _id: found._id, code: found.code, claimed: true };
        }
        const versions = new Map();
        for (const line of lines) {
          const key = String(line.product);
          if (versions.has(key)) line.version = versions.get(key);
          await reserve(line, session);
          reserved.push(line);
          versions.set(key, line.version + 1);
        }
        const discount = money(lines.reduce((sum, line) => sum + line.discount, 0));
        const businesses = [...new Set(lines.map((line) => String(line.business)))];
        const [order] = await Order.create(
          [
            {
              customer: req.user.id,
              checkoutKey,
              number: 'BL-' + randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase(),
              items: lines,
              shipping,
              subtotal,
              discount,
              total: money(subtotal - discount),
              coupon: coupon?._id,
              couponCode: coupon?.code || '',
              paymentMethod: 'cod',
              fulfillments: businesses.map((business) => ({
                business,
                status: 'placed',
                events: [{ status: 'placed', at: new Date() }],
              })),
            },
          ],
          { session },
        );
        committedOrder = order;
        await CheckoutLock.deleteOne({ _id: lock._id }, { session });
        return order;
      } catch (error) {
        if (!session && committedOrder) {
          console.error('Checkout lock cleanup failed:', error.message);
          return committedOrder;
        }
        if (!session) {
          for (const line of reserved.reverse()) await restore(line, null);
          if (coupon?.claimed) await Coupon.updateOne({ _id: coupon._id }, { $inc: { used: -1 } });
          if (lock) await CheckoutLock.deleteOne({ _id: lock._id });
        }
        throw error;
      }
    });
  } catch (error) {
    if (error.code === 11000)
      fail(409, 'Checkout is already processing. Retry using the same checkout key');
    throw error;
  }
  await notify(
    req.user.id,
    'Order placed',
    placed.number + ' is awaiting confirmation.',
    '/orders/' + placed.id,
  );
  for (const fulfillment of placed.fulfillments) {
    const business = await Business.findById(fulfillment.business);
    if (business)
      await notify(
        business.owner,
        'New order',
        placed.number + ' is ready for confirmation.',
        '/seller/orders',
      );
  }
  const order = placed.toObject();
  order.items.forEach((item) => delete item.cost);
  delete order.checkoutKey;
  res.status(201).json({ success: true, order });
};
exports.changeStatus = async (req, res) => {
  const orderId = id(req.params.id);
  const businessId = id(req.body?.business);
  const nextStatus = oneOf(
    req.body?.status,
    ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    'order status',
  );
  const trackingNumber = text(req.body?.trackingNumber || '', 'Tracking number', 0, 100);
  const business = req.user.role === 'seller' ? await ownedBusiness(req.user) : null;
  if (business && !same(business._id, businessId)) fail(403, 'You cannot manage another store');
  if (req.user.role === 'customer' && nextStatus !== 'cancelled')
    fail(403, 'Customers can only cancel unconfirmed orders');
  const order = await atomic(async (session) => {
    const current = await Order.findById(orderId).session(session);
    if (!current) fail(404, 'Order not found');
    if (req.user.role === 'customer' && !same(current.customer, req.user.id))
      fail(403, 'Order belongs to another customer');
    const fulfillment = current.fulfillments.find((f) => same(f.business, businessId));
    if (!fulfillment) fail(404, 'Store is not part of this order');
    const allowed = {
      placed: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: [],
    };
    if (req.user.role === 'customer' && fulfillment.status !== 'placed')
      fail(400, 'Only unconfirmed orders can be cancelled');
    if (!allowed[fulfillment.status].includes(nextStatus))
      fail(400, 'Invalid order status transition');
    const updated = await Order.findOneAndUpdate(
      {
        _id: orderId,
        fulfillments: { $elemMatch: { business: businessId, status: fulfillment.status } },
      },
      {
        $set: {
          'fulfillments.$.status': nextStatus,
          ...(trackingNumber ? { 'fulfillments.$.trackingNumber': trackingNumber } : {}),
        },
        $push: { 'fulfillments.$.events': { status: nextStatus, at: new Date() } },
      },
      { returnDocument: 'after', session },
    );
    if (!updated) fail(409, 'Order changed. Reload and try again');
    if (nextStatus === 'cancelled') {
      for (const item of current.items.filter((item) => same(item.business, businessId)))
        await restore(item, session);
    }
    return updated;
  });
  await notify(
    order.customer,
    'Order ' + nextStatus,
    order.number + ' has been updated.',
    '/orders/' + order.id,
  );
  const safe = order.toObject();
  safe.items.forEach((item) => delete item.cost);
  delete safe.checkoutKey;
  res.json({
    success: true,
    order: { _id: safe._id, number: safe.number, fulfillments: safe.fulfillments },
  });
};

exports.quoteOrder = async (req, res) => {
  const calculated = await quote(req.body || {});
  res.json({
    success: true,
    quote: {
      items: calculated.lines.map(({ cost, version, ...item }) => item),
      subtotal: calculated.subtotal,
      discount: calculated.discount,
      total: calculated.total,
      couponCode: calculated.coupon?.code || '',
    },
  });
};

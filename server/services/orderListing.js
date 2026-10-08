const mongoose = require('mongoose');
const { fail } = require('../utils/validation');
const states = ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
const refundStates = ['requested', 'approved', 'completed', 'rejected'];
function integer(value, fallback, min, max) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) fail(400, 'Invalid pagination');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max)
    fail(400, 'Invalid pagination');
  return parsed;
}
function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail(400, 'Use a valid date');
  const date = new Date(value + 'T00:00:00+06:00');
  if (
    !Number.isFinite(date.getTime()) ||
    new Date(date.getTime() + 21600000).toISOString().slice(0, 10) !== value
  )
    fail(400, 'Use a valid date');
  return date;
}
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function listOrders(Order, user, business, query) {
  const requestedPage = integer(query.page, 1, 1, 100000),
    limit = integer(query.limit, 20, 1, 50);
  const scope =
    user.role === 'admin'
      ? {}
      : user.role === 'seller'
        ? { 'fulfillments.business': business._id }
        : { customer: new mongoose.Types.ObjectId(user.id) };
  const conditions = [scope];
  if (query.status) {
    if (!states.includes(query.status)) fail(400, 'Invalid order status');
    conditions.push({
      fulfillments: {
        $elemMatch: { status: query.status, ...(business ? { business: business._id } : {}) },
      },
    });
  }
  if (query.refund) {
    if (query.refund === 'none')
      conditions.push(
        business
          ? { refunds: { $not: { $elemMatch: { business: business._id } } } }
          : { $or: [{ refunds: { $size: 0 } }, { refunds: { $exists: false } }] },
      );
    else {
      if (!refundStates.includes(query.refund)) fail(400, 'Invalid refund status');
      conditions.push({
        refunds: {
          $elemMatch: { status: query.refund, ...(business ? { business: business._id } : {}) },
        },
      });
    }
  }
  const from = query.from ? day(query.from) : null,
    to = query.to ? day(query.to) : null;
  if (from && to && from > to) fail(400, 'From date must not be after the to date');
  if (from || to)
    conditions.push({
      createdAt: {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lt: new Date(to.getTime() + 86400000) } : {}),
      },
    });
  const sorts = { newest: { createdAt: -1, _id: -1 }, oldest: { createdAt: 1, _id: 1 } };
  if (query.sort && !['newest', 'oldest'].includes(query.sort)) fail(400, 'Invalid order sorting');
  const sort = sorts[query.sort || 'newest'];
  const pipeline = [
    { $match: { $and: conditions } },
    {
      $lookup: {
        from: 'users',
        localField: 'customer',
        foreignField: '_id',
        pipeline: [{ $project: { name: 1, email: 1 } }],
        as: 'customer',
      },
    },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
  ];
  if (query.q) {
    if (typeof query.q !== 'string' || query.q.trim().length > 80)
      fail(400, 'Search must be at most 80 characters');
    const regex = new RegExp(escape(query.q.trim()), 'i');
    pipeline.push({
      $match: {
        $or: [
          { number: regex },
          { 'customer.name': regex },
          { 'customer.email': regex },
          { 'shipping.name': regex },
          { 'shipping.phone': regex },
        ],
      },
    });
  }
  const ownArray = (field) =>
    business
      ? {
          $filter: {
            input: { $ifNull: ['$' + field, []] },
            as: 'entry',
            cond: { $eq: ['$$entry.business', business._id] },
          },
        }
      : { $ifNull: ['$' + field, []] };
  const filterStatus = (input, status) => ({
    $filter: { input, as: 'entry', cond: { $eq: ['$$entry.status', status] } },
  });
  const active = {
    $filter: {
      input: '$fulfillments',
      as: 'entry',
      cond: { $not: [{ $in: ['$$entry.status', ['delivered', 'cancelled']] }] },
    },
  };
  const summary = [
    { $project: { fulfillments: ownArray('fulfillments'), refunds: ownArray('refunds') } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        inProgress: { $sum: { $cond: [{ $gt: [{ $size: active }, 0] }, 1, 0] } },
        delivered: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: [{ $size: active }, 0] },
                  { $gt: [{ $size: filterStatus('$fulfillments', 'delivered') }, 0] },
                ],
              },
              1,
              0,
            ],
          },
        },
        refundRequests: { $sum: { $size: filterStatus('$refunds', 'requested') } },
        refunded: {
          $sum: {
            $sum: {
              $map: {
                input: filterStatus('$refunds', 'completed'),
                as: 'entry',
                in: '$$entry.amount',
              },
            },
          },
        },
      },
    },
  ];
  const rows = (page) => [
    { $sort: sort },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    {
      $lookup: {
        from: 'businesses',
        localField: 'fulfillments.business',
        foreignField: '_id',
        pipeline: [{ $project: { name: 1 } }],
        as: '_businesses',
      },
    },
    {
      $set: {
        fulfillments: {
          $map: {
            input: '$fulfillments',
            as: 'f',
            in: {
              $mergeObjects: [
                '$$f',
                {
                  business: {
                    $ifNull: [
                      {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: '$_businesses',
                              as: 'b',
                              cond: { $eq: ['$$b._id', '$$f.business'] },
                            },
                          },
                          0,
                        ],
                      },
                      '$$f.business',
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    },
    { $unset: '_businesses' },
  ];
  const [result] = await Order.aggregate([
    ...pipeline,
    { $facet: { summary, orders: rows(requestedPage) } },
  ]);
  const counts = result.summary[0] || {
    total: 0,
    inProgress: 0,
    delivered: 0,
    refundRequests: 0,
    refunded: 0,
  };
  delete counts._id;
  const pages = Math.max(1, Math.ceil(counts.total / limit)),
    page = Math.min(requestedPage, pages);
  const orders =
    page === requestedPage ? result.orders : await Order.aggregate([...pipeline, ...rows(page)]);
  return {
    orders,
    total: counts.total,
    page,
    pages,
    limit,
    summary: counts,
    timezone: 'Asia/Dhaka',
  };
}
module.exports = { listOrders };

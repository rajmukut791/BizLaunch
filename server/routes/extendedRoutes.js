const router = require('express').Router();
const mongoose = require('mongoose');
const { protect, roles } = require('../middleware/auth');
const User = require('../models/User');
const { Business, Product, Order, Review, Wishlist } = require('../models/commerce');
const { fail, id, text, password, money } = require('../utils/validation');
const { ownedBusiness, publicProduct, notify } = require('../services/commerce');
const result = (res, data) => res.json({ success: true, ...data });
async function refreshRating(product) {
  const values = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(product)), hidden: { $ne: true } } },
    { $group: { _id: null, rating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: product },
    { $set: { rating: values[0]?.rating || 0, reviewCount: values[0]?.count || 0 } },
  );
}
router.get('/stores', async (req, res) => {
  const owners = await User.find({ role: 'seller', status: 'active' }).select('_id');
  const stores = await Business.find({
    active: true,
    verification: 'approved',
    owner: { $in: owners.map((u) => u._id) },
  })
    .select('name slug description logo coverImage category type')
    .sort({ createdAt: -1 })
    .limit(100);
  result(res, { stores });
});
router.get('/stores/:slug/reviews', async (req, res) => {
  const business = await Business.findOne({
    slug: req.params.slug,
    active: true,
    verification: 'approved',
  });
  if (!business || !(await require('../services/commerce').businessIsPublic(business)))
    fail(404, 'Store not found');
  const products = await Product.find({ business: business._id }).select('_id');
  const reviews = await Review.find({
    product: { $in: products.map((p) => p._id) },
    hidden: { $ne: true },
  })
    .populate('customer', 'name')
    .populate('product', 'name')
    .sort({ createdAt: -1 })
    .limit(100);
  result(res, {
    reviews,
    rating: reviews.length ? money(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0,
  });
});
router.use(
  [
    '/profile',
    '/wishlist',
    '/customer/reviews',
    '/seller/insights',
    '/seller/customers',
    '/seller/reviews',
    '/seller/inventory',
    '/admin/reviews',
    '/admin/products',
    '/admin/statistics',
  ],
  protect,
  require('../services/team').staffAccess,
);
router.get('/profile', (req, res) =>
  result(res, {
    profile: {
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      avatar: req.user.avatar,
      role: req.user.role,
      emailVerified: req.user.emailVerified,
    },
  }),
);
router.patch('/profile', async (req, res) => {
  const name = text(req.body?.name, 'Name', 2, 60),
    phone = text(req.body?.phone || '', 'Phone', 0, 30);
  await User.updateOne({ _id: req.user.id }, { $set: { name, phone } });
  result(res, { message: 'Profile saved' });
});
router.patch('/profile/password', async (req, res) => {
  const current = text(req.body?.currentPassword, 'Current password', 1, 72),
    secret = password(req.body?.password);
  const user = await User.findById(req.user.id).select('+password');
  if (!(await user.comparePassword(current))) fail(400, 'Current password is incorrect');
  if (secret === current) fail(400, 'Choose a different password');
  user.password = secret;
  user.tokenVersion++;
  await user.save();
  res.clearCookie('bizlaunch_session', {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
  result(res, { message: 'Password updated. Sign in again.' });
});
router.get('/wishlist', roles('customer'), async (req, res) => {
  const entries = await Wishlist.find({ customer: req.user.id })
    .populate({
      path: 'product',
      populate: [
        { path: 'business', select: 'name slug active verification owner' },
        { path: 'category', select: 'name' },
      ],
    })
    .sort({ createdAt: -1 });
  const products = [];
  for (const entry of entries)
    if (
      entry.product?.active &&
      (await require('../services/commerce').businessIsPublic(entry.product.business))
    )
      products.push(publicProduct(entry.product));
  result(res, { products });
});
router.put('/wishlist/:id', roles('customer'), async (req, res) => {
  const product = await Product.findOne({ _id: id(req.params.id), active: true });
  if (
    !product ||
    !(await require('../services/commerce').businessIsPublic(
      await Business.findById(product.business),
    ))
  )
    fail(404, 'Product not available');
  await Wishlist.updateOne(
    { customer: req.user.id, product: product._id },
    { $setOnInsert: { customer: req.user.id, product: product._id } },
    { upsert: true },
  );
  result(res, { message: 'Saved to wishlist' });
});
router.delete('/wishlist/:id', roles('customer'), async (req, res) => {
  await Wishlist.deleteOne({ customer: req.user.id, product: id(req.params.id) });
  result(res, { message: 'Removed from wishlist' });
});
router.get('/customer/reviews', roles('customer'), async (req, res) =>
  result(res, {
    reviews: await Review.find({ customer: req.user.id })
      .populate('product', 'name')
      .sort({ createdAt: -1 }),
  }),
);
router.get('/seller/customers', roles('seller'), async (req, res) => {
  const business = await ownedBusiness(req.user),
    orders = await Order.find({ 'fulfillments.business': business._id })
      .populate('customer', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();
  const customers = new Map();
  for (const order of orders) {
    if (!order.customer) continue;
    const key = String(order.customer._id),
      entry = customers.get(key) || {
        ...order.customer,
        orders: 0,
        purchase: 0,
        refunds: 0,
        lastOrder: order.createdAt,
      };
    entry.orders++;
    if (
      order.fulfillments.find((f) => String(f.business) === business.id)?.status &&
      ['delivered', 'returned'].includes(
        order.fulfillments.find((f) => String(f.business) === business.id)?.status,
      )
    )
      entry.purchase += order.items
        .filter((i) => String(i.business) === business.id)
        .reduce((s, i) => s + i.price * i.quantity - i.discount, 0);
    entry.refunds += (order.refunds || [])
      .filter((r) => String(r.business) === business.id && r.status === 'completed')
      .reduce((s, r) => s + r.amount, 0);
    customers.set(key, entry);
  }
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const rows = [...customers.values()]
    .filter((c) => [c.name, c.email, c.phone].some((v) => (v || '').toLowerCase().includes(q)))
    .map((c) => ({
      ...c,
      purchase: money(c.purchase - c.refunds),
      refunds: money(c.refunds),
      repeat: c.orders > 1,
    }));
  result(res, {
    customers: rows,
    summary: { total: rows.length, repeat: rows.filter((c) => c.repeat).length },
  });
});
router.get('/seller/reviews', roles('seller'), async (req, res) => {
  const business = await ownedBusiness(req.user),
    products = await Product.find({ business: business._id }).select('_id');
  result(res, {
    reviews: await Review.find({ product: { $in: products.map((p) => p._id) } })
      .populate('customer', 'name')
      .populate('product', 'name')
      .sort({ createdAt: -1 }),
  });
});
router.patch('/seller/reviews/:id/reply', roles('seller'), async (req, res) => {
  const business = await ownedBusiness(req.user),
    review = await Review.findById(id(req.params.id));
  if (!review || !(await Product.exists({ _id: review.product, business: business._id })))
    fail(404, 'Review not found');
  review.reply = text(req.body?.reply, 'Reply', 2, 1000);
  review.repliedAt = new Date();
  await review.save();
  await notify(
    review.customer,
    'Seller replied to your review',
    review.reply,
    '/products/' + review.product,
  );
  result(res, { review });
});
router.get('/admin/reviews', roles('admin'), async (req, res) =>
  result(res, {
    reviews: await Review.find()
      .populate('customer', 'name email')
      .populate('product', 'name business')
      .sort({ createdAt: -1 }),
  }),
);
router.patch('/admin/reviews/:id', roles('admin'), async (req, res) => {
  if (typeof req.body?.hidden !== 'boolean') fail(400, 'Hidden must be true or false');
  const review = await Review.findById(id(req.params.id));
  if (!review) fail(404, 'Review not found');
  review.hidden = req.body.hidden;
  review.moderationNote = text(req.body?.note, 'Moderation note', 5, 500);
  await review.save();
  await refreshRating(review.product);
  await notify(
    review.customer,
    'Review moderation updated',
    review.moderationNote,
    '/customer/reviews',
  );
  result(res, { review });
});
router.get('/admin/products', roles('admin'), async (req, res) =>
  result(res, {
    products: await Product.find()
      .populate('business', 'name')
      .populate('category', 'name')
      .sort({ createdAt: -1 }),
  }),
);
router.patch('/admin/products/:id', roles('admin'), async (req, res) => {
  if (typeof req.body?.active !== 'boolean') fail(400, 'Active must be true or false');
  const note = text(req.body?.note, 'Moderation note', 5, 500);
  const product = await Product.findByIdAndUpdate(
    id(req.params.id),
    { $set: { active: req.body.active }, $inc: { __v: 1 } },
    { returnDocument: 'after' },
  );
  if (!product) fail(404, 'Product not found');
  const business = await Business.findById(product.business);
  await notify(business.owner, 'Product visibility updated', note, '/seller/products');
  result(res, { product });
});

router.get('/seller/inventory/history', roles('seller'), async (req, res) => {
  const business = await ownedBusiness(req.user),
    page = Math.max(1, Math.floor(Number(req.query.page) || 1)),
    limit = 25;
  const filter = { business: business._id };
  if (req.query.product) filter._id = new mongoose.Types.ObjectId(id(req.query.product));
  const pipeline = [
    { $match: filter },
    { $unwind: '$stockMovements' },
    { $project: { product: '$_id', name: 1, entry: '$stockMovements' } },
  ];
  if (req.query.type) {
    if (!['PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT'].includes(req.query.type))
      fail(400, 'Invalid inventory type');
    pipeline.push({ $match: { 'entry.type': req.query.type } });
  }
  const [data] = await Product.aggregate([
    ...pipeline,
    {
      $facet: {
        rows: [
          { $sort: { 'entry.at': -1, 'entry._id': -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
        count: [{ $count: 'total' }],
      },
    },
  ]);
  result(res, {
    movements: data.rows,
    total: data.count[0]?.total || 0,
    page,
    pages: Math.max(1, Math.ceil((data.count[0]?.total || 0) / limit)),
  });
});
router.post('/seller/inventory/:id/adjust', roles('seller'), async (req, res) => {
  const business = await ownedBusiness(req.user),
    product = await Product.findOne({ _id: id(req.params.id), business: business._id });
  if (!product) fail(404, 'Product not found');
  const { number, oneOf } = require('../utils/validation');
  const delta = number(req.body?.delta, 'Stock change', -1000000, 1000000, true);
  if (!delta) fail(400, 'Stock change cannot be zero');
  const type = oneOf(req.body?.type, ['PURCHASE', 'RETURN', 'ADJUSTMENT'], 'inventory type');
  if (type !== 'ADJUSTMENT' && delta < 0)
    fail(400, 'Purchase and return quantities must be positive');
  const note = text(req.body?.note, 'Stock note', 5, 500),
    version = number(req.body?.version, 'Product version', 0, 100000000, true);
  const variant = product.variants.length ? product.variants.id(id(req.body?.variantId)) : null;
  if (product.variants.length && !variant) fail(400, 'Choose a valid variant');
  const before = variant?.stock ?? product.stock,
    after = before + delta;
  if (after < 0 || after > 1000000) fail(400, 'Resulting stock must be between 0 and 1000000');
  const updated = await Product.findOneAndUpdate(
    { _id: product._id, __v: version, ...(variant ? { 'variants._id': variant._id } : {}) },
    {
      $inc: { __v: 1, ...(variant ? { 'variants.$.stock': delta } : { stock: delta }) },
      $push: {
        stockMovements: {
          type,
          before,
          after,
          delta,
          variantId: variant?.id || '',
          note,
          actor: req.user._id,
          at: new Date(),
        },
      },
    },
    { returnDocument: 'after', runValidators: true },
  );
  if (!updated) fail(409, 'Inventory changed. Reload before adjusting');
  result(res, {
    product:
      req.staff && !req.member.permissions.includes('finance') ? publicProduct(updated) : updated,
  });
});

router.post(
  '/seller/business/images',
  protect,
  require('../services/team').staffAccess,
  roles('seller'),
  require('multer')({
    storage: require('multer').memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  }).single('image'),
  async (req, res) => {
    const business = await ownedBusiness(req.user),
      { oneOf } = require('../utils/validation');
    const target = oneOf(req.body?.target, ['logo', 'coverImage'], 'branding target'),
      image = await require('../services/assets').saveImage(req.file);
    const updated = await Business.findByIdAndUpdate(
      business._id,
      { $set: { [target]: image } },
      { returnDocument: 'after' },
    );
    result(res, { business: updated });
  },
);
router.get('/seller/insights', roles('seller'), async (req, res) =>
  result(res, {
    insights: await require('../services/insights').insights(
      await ownedBusiness(req.user),
      req.query,
    ),
  }),
);

router.get('/admin/statistics', roles('admin'), async (req, res) => {
  const { Category, Report } = require('../models/commerce');
  const [users, businesses, orders, products, reports, categories] = await Promise.all([
    User.find().select('role status'),
    Business.find().select('name slug verification active'),
    Order.find().lean(),
    Product.find().select('business active stock variants rating reviewCount'),
    Report.countDocuments({ status: 'open' }),
    Category.countDocuments(),
  ]);
  const stores = new Map(
    businesses.map((b) => [
      String(b._id),
      { business: b._id, name: b.name, orders: 0, revenue: 0, refunds: 0, products: 0 },
    ]),
  );
  for (const order of orders) {
    for (const f of order.fulfillments) {
      const store = stores.get(String(f.business));
      if (!store) continue;
      store.orders++;
      if (['delivered', 'returned'].includes(f.status))
        store.revenue += order.items
          .filter((i) => String(i.business) === String(f.business))
          .reduce((sum, i) => sum + i.price * i.quantity - i.discount, 0);
    }
    for (const r of order.refunds || []) {
      if (r.status !== 'completed') continue;
      const store = stores.get(String(r.business));
      if (store) {
        store.revenue -= r.amount;
        store.refunds += r.amount;
      }
    }
  }
  for (const product of products) {
    const store = stores.get(String(product.business));
    if (store && product.active) store.products++;
  }
  const activity = new Map();
  for (const order of orders) {
    const day = new Date(new Date(order.createdAt).getTime() + 21600000).toISOString().slice(0, 10);
    activity.set(day, (activity.get(day) || 0) + 1);
  }
  result(res, {
    statistics: {
      users: users.length,
      customers: users.filter((u) => u.role === 'customer').length,
      sellers: users.filter((u) => u.role === 'seller').length,
      staff: users.filter((u) => u.role === 'staff').length,
      suspended: users.filter((u) => u.status === 'suspended').length,
      businesses: businesses.length,
      pending: businesses.filter((b) => b.verification === 'pending').length,
      suspendedBusinesses: businesses.filter((b) => !b.active).length,
      products: products.length,
      orders: orders.length,
      reports,
      categories,
      sales: money([...stores.values()].reduce((sum, s) => sum + s.revenue, 0)),
      stores: [...stores.values()]
        .map((s) => ({ ...s, revenue: money(s.revenue), refunds: money(s.refunds) }))
        .sort((a, b) => b.revenue - a.revenue),
      activity: [...activity]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-30)
        .map(([date, orders]) => ({ date, orders })),
    },
  });
});

router.post(
  '/profile/images',
  require('multer')({
    storage: require('multer').memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  }).single('image'),
  async (req, res) => {
    const avatar = await require('../services/assets').saveImage(req.file);
    await User.updateOne({ _id: req.user.id }, { $set: { avatar } });
    result(res, { avatar });
  },
);
module.exports = router;

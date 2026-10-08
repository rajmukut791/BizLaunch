const router = require('express').Router();
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs/promises');
const multer = require('multer');
const mongoose = require('mongoose');
const User = require('../models/User');
const {
  Business,
  Category,
  Product,
  Order,
  Coupon,
  Expense,
  Review,
  Notification,
  Report,
} = require('../models/commerce');
const { protect, roles } = require('../middleware/auth');
const { fail, text, number, id, oneOf, money } = require('../utils/validation');
const {
  ownedBusiness,
  notify,
  publicProduct,
  analytics,
  businessIsPublic,
} = require('../services/commerce');
const checkout = require('../controllers/checkoutController');
const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const result = (res, data, status = 200) => res.status(status).json({ success: true, ...data });
const same = (a, b) => String(a) === String(b);
const boolean = (value, label) => {
  if (typeof value !== 'boolean') fail(400, label + ' must be true or false');
  return value;
};
const parseDate = (value, label) => {
  const date = new Date(text(value, label, 1, 40));
  if (!Number.isFinite(date.getTime())) fail(400, 'Invalid ' + label);
  return date;
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/categories', async (req, res) =>
  result(res, { categories: await Category.find().sort({ name: 1 }) }),
);
router.get('/products', async (req, res) => {
  const owners = await User.find({ role: 'seller', status: 'active' }).select('_id');
  const businesses = await Business.find({
    verification: 'approved',
    active: true,
    owner: { $in: owners.map((owner) => owner._id) },
  }).select('_id');
  const query = { active: true, business: { $in: businesses.map((b) => b._id) } };
  if (req.query.business)
    query.business = {
      $in: businesses.filter((b) => same(b._id, id(req.query.business))).map((b) => b._id),
    };
  if (req.query.category) query.category = id(req.query.category);
  if (req.query.q)
    query.name = { $regex: escapeRegex(text(req.query.q, 'Search', 1, 100)), $options: 'i' };
  const numericQuery = (value, label) => {
    if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value))
      fail(400, 'Invalid ' + label);
    return number(Number(value), label);
  };
  if (req.query.min || req.query.max) {
    query.price = {};
    if (req.query.min) query.price.$gte = numericQuery(req.query.min, 'minimum price');
    if (req.query.max) query.price.$lte = numericQuery(req.query.max, 'maximum price');
  }
  const sorts = {
    newest: { createdAt: -1, _id: -1 },
    priceAsc: { price: 1, _id: 1 },
    priceDesc: { price: -1, _id: -1 },
    rating: { rating: -1, _id: -1 },
  };
  const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page) || 1)));
  const limit = 12;
  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('business', 'name slug')
      .populate('category', 'name')
      .sort(sorts[req.query.sort] || sorts.newest)
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(query),
  ]);
  result(res, {
    products: products.map(publicProduct),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});
router.get('/products/:id', async (req, res) => {
  const product = await Product.findOne({ _id: id(req.params.id), active: true })
    .populate('business', 'name slug verification active description owner')
    .populate('category', 'name');
  if (!product || !(await businessIsPublic(product.business))) fail(404, 'Product not found');
  const reviews = await Review.find({ product: product._id })
    .populate('customer', 'name')
    .sort({ createdAt: -1 })
    .limit(50);
  result(res, { product: publicProduct(product), reviews });
});
router.get('/stores/:slug', async (req, res) => {
  const business = await Business.findOne({
    slug: text(req.params.slug, 'Store', 1, 100),
    verification: 'approved',
    active: true,
  }).select('-verificationNote');
  if (!(await businessIsPublic(business))) fail(404, 'Store not found');
  const publicBusiness = business.toObject();
  delete publicBusiness.owner;
  result(res, { business: publicBusiness });
});

router.use(protect);
router.get('/notifications', async (req, res) =>
  result(res, {
    notifications: await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100),
    unread: await Notification.countDocuments({ user: req.user.id, read: false }),
  }),
);
router.patch('/notifications/read', async (req, res) => {
  await Notification.updateMany({ user: req.user.id, read: false }, { $set: { read: true } });
  result(res, {});
});
router.get('/orders', async (req, res) => {
  let filter;
  if (req.user.role === 'admin') filter = {};
  else if (req.user.role === 'seller')
    filter = { 'fulfillments.business': (await ownedBusiness(req.user))._id };
  else filter = { customer: req.user.id };
  const orders = await Order.find(filter)
    .populate('customer', 'name email')
    .populate('fulfillments.business', 'name')
    .sort({ createdAt: -1 })
    .limit(200);
  const own = req.user.role === 'seller' ? await ownedBusiness(req.user) : null;
  result(res, { orders: orders.map((order) => safeOrder(order, req.user, own)) });
});
function safeOrder(order, user, business) {
  const data = order.toObject ? order.toObject() : order;
  if (user.role === 'seller') {
    data.items = data.items.filter((item) => same(item.business, business._id));
    data.fulfillments = data.fulfillments.filter((f) =>
      same(f.business._id || f.business, business._id),
    );
    data.subtotal = money(data.items.reduce((sum, item) => sum + item.price * item.quantity, 0));
    data.discount = money(data.items.reduce((sum, item) => sum + item.discount, 0));
    data.total = money(data.subtotal - data.discount);
  }
  if (user.role !== 'seller' && user.role !== 'admin')
    data.items.forEach((item) => delete item.cost);
  data.payableTotal = money(
    data.items
      .filter((item) =>
        data.fulfillments.some(
          (f) => same(f.business._id || f.business, item.business) && f.status !== 'cancelled',
        ),
      )
      .reduce((sum, item) => sum + item.price * item.quantity - item.discount, 0),
  );
  delete data.checkoutKey;
  return data;
}
router.get('/orders/:id', async (req, res) => {
  const order = await Order.findById(id(req.params.id))
    .populate('customer', 'name email')
    .populate('fulfillments.business', 'name');
  if (!order) fail(404, 'Order not found');
  let business;
  if (req.user.role === 'seller') {
    business = await ownedBusiness(req.user);
    if (!order.fulfillments.some((f) => same(f.business._id, business._id)))
      fail(403, 'Order belongs to another store');
  } else if (req.user.role !== 'admin' && !same(order.customer._id, req.user.id))
    fail(403, 'Order belongs to another customer');
  result(res, { order: safeOrder(order, req.user, business) });
});
router.post('/checkout/quote', roles('customer'), checkout.quoteOrder);
router.post('/checkout', roles('customer'), checkout.placeOrder);
router.patch('/orders/:id/status', checkout.changeStatus);
router.post('/products/:id/reviews', roles('customer'), async (req, res) => {
  const productId = id(req.params.id);
  const product = await Product.findById(productId);
  if (!product || !product.active) fail(404, 'Product not found');
  const purchased = await Order.exists({
    customer: req.user.id,
    items: { $elemMatch: { product: productId, business: product.business } },
    fulfillments: { $elemMatch: { business: product.business, status: 'delivered' } },
  });
  if (!purchased) fail(403, 'You can review a product after delivery');
  const rating = number(req.body?.rating, 'Rating', 1, 5, true);
  const comment = text(req.body?.comment, 'Review', 3, 1000);
  const review = await Review.findOneAndUpdate(
    { customer: req.user.id, product: productId },
    { $set: { rating, comment } },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );
  const ratings = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: null, rating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: productId },
    { $set: { rating: ratings[0].rating, reviewCount: ratings[0].count } },
  );
  result(res, { review }, 201);
});
router.post('/reports', async (req, res) => {
  const business = await Business.findById(id(req.body?.business));
  if (!business) fail(404, 'Business not found');
  const report = await Report.create({
    reporter: req.user.id,
    business: business._id,
    reason: text(req.body?.reason, 'Reason', 10, 2000),
  });
  result(res, { report }, 201);
});

router.get('/seller/business', roles('seller'), async (req, res) =>
  result(res, { business: await Business.findOne({ owner: req.user.id }) }),
);
router.post('/seller/business', roles('seller'), async (req, res) => {
  const name = text(req.body?.name, 'Business name', 2, 80);
  const slug = slugify(text(req.body?.slug, 'Store URL', 3, 80));
  if (slug.length < 3) fail(400, 'Store URL must contain at least 3 letters or numbers');
  const business = await Business.create({
    owner: req.user.id,
    name,
    slug,
    description: text(req.body?.description || '', 'Description', 0, 2000),
    phone: text(req.body?.phone, 'Phone', 5, 30),
    address: text(req.body?.address, 'Address', 5, 300),
  });
  await notify(
    req.user.id,
    'Business submitted',
    'Your store is awaiting administrator verification.',
    '/seller/business',
  );
  result(res, { business }, 201);
});
router.patch('/seller/business', roles('seller'), async (req, res) => {
  const business = await ownedBusiness(req.user);
  const data = {};
  for (const [key, min, max] of [
    ['name', 2, 80],
    ['description', 0, 2000],
    ['phone', 5, 30],
    ['address', 5, 300],
  ])
    if (req.body[key] !== undefined) data[key] = text(req.body[key], key, min, max);
  if (req.body.resubmit === true && business.verification === 'rejected') {
    data.verification = 'pending';
    data.verificationNote = '';
  }
  if (data.name || data.address || data.phone) {
    data.verification = 'pending';
    data.verificationNote = 'Business details changed; verification required';
  }
  const updated = await Business.findByIdAndUpdate(
    business._id,
    { $set: data },
    { returnDocument: 'after', runValidators: true },
  );
  result(res, { business: updated });
});
router.get('/seller/analytics', roles('seller'), async (req, res) =>
  result(res, { analytics: await analytics(await ownedBusiness(req.user)) }),
);
router.get('/seller/products', roles('seller'), async (req, res) =>
  result(res, {
    products: await Product.find({ business: (await ownedBusiness(req.user))._id })
      .populate('category', 'name')
      .sort({ createdAt: -1 }),
  }),
);
function productData(body, creating) {
  const data = {};
  if (creating || body.name !== undefined) data.name = text(body.name, 'Product name', 2, 120);
  if (creating || body.description !== undefined)
    data.description = text(body.description || '', 'Description', 0, 4000);
  if (creating || body.category !== undefined) data.category = id(body.category);
  for (const key of ['price', 'cost', 'stock'])
    if (creating || body[key] !== undefined)
      data[key] = number(
        body[key] ?? 0,
        key,
        key === 'price' ? 0.01 : 0,
        key === 'stock' ? 1000000 : 1000000,
        key === 'stock',
      );
  if (body.active !== undefined) data.active = boolean(body.active, 'Active');
  if (body.variants !== undefined) {
    if (!Array.isArray(body.variants) || body.variants.length > 30)
      fail(400, 'Use at most 30 variants');
    data.variants = body.variants.map((variant) => ({
      ...(variant._id ? { _id: id(variant._id) } : {}),
      name: text(variant.name, 'Variant name', 1, 80),
      sku: text(variant.sku, 'SKU', 1, 60),
      price: number(variant.price, 'Variant price', 0.01, 1000000),
      cost: number(variant.cost ?? 0, 'Variant cost', 0, 1000000),
      stock: number(variant.stock, 'Variant stock', 0, 1000000, true),
    }));
    if (new Set(data.variants.map((v) => v.sku.toLowerCase())).size !== data.variants.length)
      fail(400, 'Variant SKUs must be unique');
    if (data.variants.length) {
      data.price = Math.min(...data.variants.map((v) => v.price));
      data.stock = 0;
    }
  }
  return data;
}
router.post('/seller/products', roles('seller'), async (req, res) => {
  const business = await ownedBusiness(req.user);
  const data = productData(req.body || {}, true);
  if (!(await Category.exists({ _id: data.category }))) fail(400, 'Choose an existing category');
  const product = await Product.create({ ...data, business: business._id });
  result(res, { product }, 201);
});
router.patch('/seller/products/:id', roles('seller'), async (req, res) => {
  const business = await ownedBusiness(req.user);
  const data = productData(req.body || {}, false);
  if (data.category && !(await Category.exists({ _id: data.category })))
    fail(400, 'Choose an existing category');
  const version = number(req.body?.version, 'Product version', 0, 100000000, true);
  const current = await Product.findOne({ _id: id(req.params.id), business: business._id });
  if (!current) fail(404, 'Product not found');
  if (data.variants === undefined && current.variants.length) {
    if (data.stock !== undefined || data.price !== undefined)
      fail(400, 'Edit variant prices and stock through the variant editor');
  }
  if (data.variants && current.variants.length) {
    const existing = new Set(current.variants.map((v) => v.id));
    if (current.variants.some((v) => !data.variants.some((incoming) => incoming._id === v.id)))
      fail(
        400,
        'Keep existing variants for order history. Set their stock to zero or archive the product',
      );
    if (data.variants.some((v) => v._id && !existing.has(v._id)))
      fail(400, 'Variant does not belong to this product');
  }
  const product = await Product.findOneAndUpdate(
    { _id: current._id, business: business._id, __v: version },
    { $set: data, $inc: { __v: 1 } },
    { returnDocument: 'after', runValidators: true },
  );
  if (!product) fail(409, 'Product changed. Reload before editing stock');
  result(res, { product });
});
router.delete('/seller/products/:id', roles('seller'), async (req, res) => {
  const business = await ownedBusiness(req.user);
  const product = await Product.findOneAndUpdate(
    { _id: id(req.params.id), business: business._id },
    { $set: { active: false }, $inc: { __v: 1 } },
    { returnDocument: 'after' },
  );
  if (!product) fail(404, 'Product not found');
  result(res, { product });
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
router.post(
  '/seller/products/:id/images',
  roles('seller'),
  upload.single('image'),
  async (req, res) => {
    const business = await ownedBusiness(req.user);
    const product = await Product.findOne({ _id: id(req.params.id), business: business._id });
    if (!product) fail(404, 'Product not found');
    if (!req.file) fail(400, 'Choose a PNG, JPEG or WebP image');
    const buffer = req.file.buffer;
    let extension;
    if (
      buffer.length > 24 &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      extension = 'png';
    else if (buffer.length > 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
      extension = 'jpg';
    else if (
      buffer.length > 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    )
      extension = 'webp';
    else fail(400, 'Only PNG, JPEG and WebP files are accepted');
    const filename = randomUUID() + '.' + extension;
    const folder = path.join(__dirname, '../uploads');
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, filename), buffer, { flag: 'wx' });
    const image = '/uploads/' + filename;
    const updated = await Product.findOneAndUpdate(
      { _id: product._id, business: business._id, 'images.7': { $exists: false } },
      { $push: { images: image }, $inc: { __v: 1 } },
      { returnDocument: 'after' },
    );
    if (!updated) {
      await fs.unlink(path.join(folder, filename));
      fail(400, 'Maximum 8 images per product');
    }
    result(res, { product: updated }, 201);
  },
);
router.delete('/seller/products/:id/images/:index', roles('seller'), async (req, res) => {
  const business = await ownedBusiness(req.user);
  const product = await Product.findOne({ _id: id(req.params.id), business: business._id });
  if (!product) fail(404, 'Product not found');
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= product.images.length)
    fail(400, 'Invalid image index');
  product.images.splice(index, 1);
  product.increment();
  await product.save();
  result(res, { product });
});
router.get('/seller/expenses', roles('seller'), async (req, res) =>
  result(res, {
    expenses: await Expense.find({ business: (await ownedBusiness(req.user))._id }).sort({
      date: -1,
    }),
  }),
);
router.post('/seller/expenses', roles('seller'), async (req, res) => {
  const expense = await Expense.create({
    business: (await ownedBusiness(req.user))._id,
    title: text(req.body?.title, 'Title', 2, 120),
    category: oneOf(
      req.body?.category,
      ['rent', 'marketing', 'utilities', 'salary', 'shipping', 'other'],
      'expense category',
    ),
    amount: number(req.body?.amount, 'Amount', 0.01, 10000000),
    date: parseDate(req.body?.date, 'Date'),
    note: text(req.body?.note || '', 'Note', 0, 1000),
  });
  result(res, { expense }, 201);
});
router.delete('/seller/expenses/:id', roles('seller'), async (req, res) => {
  const expense = await Expense.findOneAndDelete({
    _id: id(req.params.id),
    business: (await ownedBusiness(req.user))._id,
  });
  if (!expense) fail(404, 'Expense not found');
  result(res, {});
});
router.get('/seller/coupons', roles('seller'), async (req, res) =>
  result(res, {
    coupons: await Coupon.find({ business: (await ownedBusiness(req.user))._id }).sort({
      createdAt: -1,
    }),
  }),
);
router.post('/seller/coupons', roles('seller'), async (req, res) => {
  const code = text(req.body?.code, 'Coupon code', 3, 30).toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(code))
    fail(400, 'Use letters, numbers, underscore or dash in a coupon code');
  const expiresAt = parseDate(req.body?.expiresAt, 'Expiry');
  if (expiresAt <= new Date()) fail(400, 'Expiry must be in the future');
  const coupon = await Coupon.create({
    business: (await ownedBusiness(req.user))._id,
    code,
    percent: number(req.body?.percent, 'Discount percentage', 1, 80, true),
    minimum: number(req.body?.minimum ?? 0, 'Minimum purchase', 0, 1000000),
    limit: number(req.body?.limit ?? 100, 'Usage limit', 1, 1000000, true),
    expiresAt,
  });
  result(res, { coupon }, 201);
});
router.patch('/seller/coupons/:id', roles('seller'), async (req, res) => {
  const coupon = await Coupon.findOneAndUpdate(
    { _id: id(req.params.id), business: (await ownedBusiness(req.user))._id },
    { $set: { active: boolean(req.body?.active, 'Active') } },
    { returnDocument: 'after' },
  );
  if (!coupon) fail(404, 'Coupon not found');
  result(res, { coupon });
});
router.get('/seller/reports/export', roles('seller'), async (req, res) => {
  const business = await ownedBusiness(req.user);
  const summary = await analytics(business);
  result(res, {
    report: {
      business: business.name,
      generatedAt: new Date(),
      currency: 'BDT',
      recognition: 'Revenue and product cost are recognized on delivery',
      ...summary,
    },
  });
});

router.use('/admin', roles('admin'));
router.get('/admin/overview', async (req, res) => {
  const [users, businesses, products, orders, pending, reports] = await Promise.all([
    User.countDocuments(),
    Business.countDocuments(),
    Product.countDocuments({ active: true }),
    Order.countDocuments(),
    Business.countDocuments({ verification: 'pending' }),
    Report.countDocuments({ status: 'open' }),
  ]);
  const values = await Order.aggregate([
    { $unwind: '$items' },
    {
      $match: {
        $expr: {
          $in: [
            '$items.business',
            {
              $map: {
                input: {
                  $filter: {
                    input: '$fulfillments',
                    as: 'f',
                    cond: { $eq: ['$$f.status', 'delivered'] },
                  },
                },
                as: 'f',
                in: '$$f.business',
              },
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        revenue: {
          $sum: {
            $subtract: [{ $multiply: ['$items.price', '$items.quantity'] }, '$items.discount'],
          },
        },
      },
    },
  ]);
  result(res, {
    overview: {
      users,
      businesses,
      products,
      orders,
      pending,
      reports,
      revenue: money(values[0]?.revenue || 0),
    },
  });
});
router.get('/admin/businesses', async (req, res) =>
  result(res, {
    businesses: await Business.find()
      .populate('owner', 'name email')
      .sort({ createdAt: -1 })
      .limit(200),
  }),
);
router.patch('/admin/businesses/:id', async (req, res) => {
  const data = {};
  if (req.body.verification !== undefined)
    data.verification = oneOf(
      req.body.verification,
      ['pending', 'approved', 'rejected'],
      'verification status',
    );
  if (req.body.active !== undefined) data.active = boolean(req.body.active, 'Active');
  data.verificationNote = text(req.body.note || '', 'Note', 0, 500);
  const business = await Business.findByIdAndUpdate(
    id(req.params.id),
    { $set: data },
    { returnDocument: 'after' },
  );
  if (!business) fail(404, 'Business not found');
  await notify(
    business.owner,
    'Business verification updated',
    data.verificationNote || 'Your business verification or availability has changed.',
    '/seller/business',
  );
  result(res, { business });
});
router.get('/admin/users', async (req, res) =>
  result(res, {
    users: await User.find().select('-tokenVersion').sort({ createdAt: -1 }).limit(200),
  }),
);
router.patch('/admin/users/:id', async (req, res) => {
  const userId = id(req.params.id);
  if (userId === req.user.id) fail(400, 'You cannot suspend your own account');
  const user = await User.findOneAndUpdate(
    { _id: userId, role: { $ne: 'admin' } },
    {
      $set: { status: oneOf(req.body?.status, ['active', 'suspended'], 'user status') },
      $inc: { tokenVersion: 1 },
    },
    { returnDocument: 'after' },
  );
  if (!user) fail(404, 'User not found or protected administrator');
  result(res, { user });
});
router.post('/admin/categories', async (req, res) => {
  const name = text(req.body?.name, 'Category name', 2, 80);
  const slug = slugify(name);
  if (!slug) fail(400, 'Category name must contain letters or numbers');
  const category = await Category.create({
    name,
    slug,
    description: text(req.body?.description || '', 'Description', 0, 500),
  });
  result(res, { category }, 201);
});
router.patch('/admin/categories/:id', async (req, res) => {
  const name = text(req.body?.name, 'Category name', 2, 80);
  const category = await Category.findByIdAndUpdate(
    id(req.params.id),
    { $set: { name, description: text(req.body?.description || '', 'Description', 0, 500) } },
    { returnDocument: 'after', runValidators: true },
  );
  if (!category) fail(404, 'Category not found');
  result(res, { category });
});
router.delete('/admin/categories/:id', async (req, res) => {
  const categoryId = id(req.params.id);
  if (await Product.exists({ category: categoryId }))
    fail(409, 'Move products to another category before deleting');
  if (!(await Category.findByIdAndDelete(categoryId))) fail(404, 'Category not found');
  result(res, {});
});
router.get('/admin/reports', async (req, res) =>
  result(res, {
    reports: await Report.find()
      .populate('reporter', 'name email')
      .populate('business', 'name')
      .sort({ createdAt: -1 })
      .limit(200),
  }),
);
router.patch('/admin/reports/:id', async (req, res) => {
  const report = await Report.findByIdAndUpdate(
    id(req.params.id),
    {
      $set: {
        status: oneOf(req.body?.status, ['open', 'resolved', 'dismissed'], 'report status'),
        resolution: text(req.body?.resolution || '', 'Resolution', 0, 1000),
      },
    },
    { returnDocument: 'after' },
  );
  if (!report) fail(404, 'Report not found');
  await notify(
    report.reporter,
    'Report updated',
    report.resolution || 'Your report status is now ' + report.status,
    '/notifications',
  );
  result(res, { report });
});
module.exports = router;

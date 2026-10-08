const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
require('../config/env')();
process.env.NODE_ENV = 'test';
const app = require('../app');
const User = require('../models/User');
const models = require('../models/commerce');
const { Business, Product, Order, Coupon, Review, Notification } = models;
const database = 'bizlaunch_test_' + randomUUID().replaceAll('-', '');
let server, base;
const users = {},
  cookies = {};
let business, secondBusiness, category, product, variantProduct, order, coupon;

async function request(url, method = 'GET', body, role, extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Origin: process.env.CLIENT_URL,
    ...(role ? { Cookie: cookies[role] } : {}),
    ...extra,
  };
  const response = await fetch(base + url, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  return { status: response.status, data, cookie: response.headers.get('set-cookie') };
}
async function expect(url, method, body, role, status, headers) {
  const result = await request(url, method, body, role, headers);
  assert.equal(result.status, status, JSON.stringify(result.data));
  return result.data;
}
const shipping = {
  name: 'Test Customer',
  phone: '01712345678',
  address: 'House 10, Test Road',
  city: 'Dhaka',
  postalCode: '1205',
};
const checkout = (items, couponCode = '') => ({
  items,
  shipping,
  couponCode,
  paymentMethod: 'cod',
});
before(async () => {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: database,
    serverSelectionTimeoutMS: 5000,
  });
  assert.equal(mongoose.connection.name, database);
  await Promise.all([User.init(), ...Object.values(models).map((model) => model.init())]);
  users.admin = await User.create({
    name: 'Test Admin',
    email: 'admin@test.example',
    password: 'TestSecret123!',
    role: 'admin',
  });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = 'http://127.0.0.1:' + server.address().port + '/api';
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState === 1) {
    assert.match(mongoose.connection.name, /^bizlaunch_test_[a-f0-9]{32}$/);
    assert.equal(mongoose.connection.name, database);
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

test('health and readiness endpoints are available', async () => {
  await expect('/health', 'GET', undefined, undefined, 200);
  await expect('/ready', 'GET', undefined, undefined, 200);
});
test('register validates types, rejects administrator signup and weak passwords', async () => {
  await expect(
    '/auth/register',
    'POST',
    { name: {}, email: 'x@test.example', password: 'TestSecret123!' },
    undefined,
    400,
  );
  await expect(
    '/auth/register',
    'POST',
    { name: 'Admin Attempt', email: 'x@test.example', password: 'TestSecret123!', role: 'admin' },
    undefined,
    400,
  );
  await expect(
    '/auth/register',
    'POST',
    { name: 'Weak User', email: 'x@test.example', password: 'short' },
    undefined,
    400,
  );
});
test('register hashes passwords and creates private cookie sessions', async () => {
  for (const role of ['seller', 'seller2', 'customer', 'customer2']) {
    const result = await request('/auth/register', 'POST', {
      name: 'Test ' + role,
      email: role + '@test.example',
      password: 'TestSecret123!',
      role: role.startsWith('seller') ? 'seller' : 'customer',
    });
    assert.equal(result.status, 201);
    assert.match(result.cookie, /HttpOnly/);
    assert.match(result.cookie, /SameSite=Strict/i);
    assert.equal(result.data.token, undefined);
    assert.equal(result.data.user.password, undefined);
    cookies[role] = result.cookie.split(';')[0];
    users[role] = await User.findById(result.data.user.id).select('+password');
    assert.notEqual(users[role].password, 'TestSecret123!');
    assert.equal(await users[role].comparePassword('TestSecret123!'), true);
  }
});
test('duplicate email, invalid login and missing sessions are rejected', async () => {
  await expect(
    '/auth/register',
    'POST',
    { name: 'Duplicate', email: ' CUSTOMER@TEST.EXAMPLE ', password: 'TestSecret123!' },
    undefined,
    409,
  );
  await expect(
    '/auth/login',
    'POST',
    { email: 'customer@test.example', password: 'incorrect' },
    undefined,
    401,
  );
  await expect('/auth/me', 'GET', undefined, undefined, 401);
  const result = await request('/auth/login', 'POST', {
    email: 'admin@test.example',
    password: 'TestSecret123!',
  });
  assert.equal(result.status, 200);
  cookies.admin = result.cookie.split(';')[0];
});
test('roles and request origin are enforced server-side', async () => {
  await expect('/admin/overview', 'GET', undefined, 'customer', 403);
  await expect('/seller/business', 'POST', { name: 'Attempt' }, 'customer', 403);
  await expect('/auth/logout', 'POST', {}, 'customer', 403, {
    Origin: 'https://untrusted.example',
  });
});
test('business ownership is unique and new stores await verification', async () => {
  business = (
    await expect(
      '/seller/business',
      'POST',
      {
        name: 'Test Store',
        slug: 'test-store',
        phone: '01712345678',
        address: 'Dhaka Test Address',
        description: 'A test shop',
      },
      'seller',
      201,
    )
  ).business;
  secondBusiness = (
    await expect(
      '/seller/business',
      'POST',
      {
        name: 'Second Store',
        slug: 'second-store',
        phone: '01712345678',
        address: 'Dhaka Test Address',
      },
      'seller2',
      201,
    )
  ).business;
  assert.equal(business.verification, 'pending');
  await expect(
    '/seller/business',
    'POST',
    {
      name: 'Duplicate Store',
      slug: 'duplicate-store',
      phone: '01712345678',
      address: 'Dhaka Test Address',
    },
    'seller',
    409,
  );
});
test('administrator manages categories and sellers cannot create categories', async () => {
  category = (
    await expect(
      '/admin/categories',
      'POST',
      { name: 'Test Category', description: 'Test' },
      'admin',
      201,
    )
  ).category;
  await expect('/admin/categories', 'POST', { name: 'No Access' }, 'seller', 403);
  await expect(
    '/admin/categories/' + category._id,
    'PATCH',
    { name: 'Test Collection', description: 'Updated' },
    'admin',
    200,
  );
});
test('product CRUD validates stock, variants and ownership', async () => {
  product = (
    await expect(
      '/seller/products',
      'POST',
      {
        name: 'Test Product',
        category: category._id,
        price: 500,
        cost: 200,
        stock: 10,
        description: 'Useful test item',
      },
      'seller',
      201,
    )
  ).product;
  variantProduct = (
    await expect(
      '/seller/products',
      'POST',
      {
        name: 'Variant Product',
        category: category._id,
        price: 600,
        cost: 250,
        stock: 0,
        variants: [{ name: 'Small', sku: 'SMALL', price: 600, cost: 250, stock: 5 }],
      },
      'seller',
      201,
    )
  ).product;
  await expect(
    '/seller/products',
    'POST',
    { name: 'Negative stock', category: category._id, price: 100, stock: -1 },
    'seller',
    400,
  );
  await expect(
    '/seller/products/' + product._id,
    'PATCH',
    { name: 'Stolen', version: 0 },
    'seller2',
    404,
  );
  await expect(
    '/seller/products/' + product._id,
    'PATCH',
    { stock: 11, version: 99 },
    'seller',
    409,
  );
  await expect('/admin/categories/' + category._id, 'DELETE', {}, 'admin', 409);
});
test('only approved stores appear publicly and public products hide costs', async () => {
  const pending = await expect('/products', 'GET', undefined, undefined, 200);
  assert.equal(pending.products.length, 0);
  await expect('/products/' + product._id, 'GET', undefined, undefined, 404);
  await expect(
    '/admin/businesses/' + business._id,
    'PATCH',
    { verification: 'approved', note: 'Approved test store' },
    'admin',
    200,
  );
  await expect(
    '/admin/businesses/' + secondBusiness._id,
    'PATCH',
    { verification: 'approved' },
    'admin',
    200,
  );
  const found = await expect(
    '/products?q=Test&sort=priceAsc&min=100&max=1000',
    'GET',
    undefined,
    undefined,
    200,
  );
  assert.equal(found.total, 1);
  assert.equal(found.products[0].cost, undefined);
  const variants = await expect(
    '/products/' + variantProduct._id,
    'GET',
    undefined,
    undefined,
    200,
  );
  assert.equal(variants.product.variants[0].cost, undefined);
  await expect('/stores/test-store', 'GET', undefined, undefined, 200);
  const literal = await expect(
    '/products?q=' + encodeURIComponent('.*'),
    'GET',
    undefined,
    undefined,
    200,
  );
  assert.equal(literal.total, 0);
  await expect('/products?min=invalid', 'GET', undefined, undefined, 400);
});
test('invalid image payloads are rejected', async () => {
  const data = new FormData();
  data.append('image', new Blob(['<svg onload="alert(1)"/>'], { type: 'image/png' }), 'image.png');
  const response = await fetch(base + '/seller/products/' + product._id + '/images', {
    method: 'POST',
    headers: { Cookie: cookies.seller, Origin: process.env.CLIENT_URL },
    body: data,
  });
  assert.equal(response.status, 400);
});
test('coupons validate minimum, expiry and store scope', async () => {
  coupon = (
    await expect(
      '/seller/coupons',
      'POST',
      {
        code: 'TEST10',
        percent: 10,
        minimum: 300,
        limit: 10,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
      'seller',
      201,
    )
  ).coupon;
  await expect(
    '/seller/coupons',
    'POST',
    { code: 'BADDATE', percent: 10, minimum: 0, limit: 1, expiresAt: 'invalid' },
    'seller',
    400,
  );
  await expect(
    '/checkout',
    'POST',
    checkout([{ product: product._id, quantity: 1 }], 'MISSING'),
    'customer',
    400,
    { 'Idempotency-Key': randomUUID() },
  );
});
test('checkout uses server prices and coupons, reserves stock and is idempotent', async () => {
  const key = randomUUID();
  order = (
    await expect(
      '/checkout',
      'POST',
      checkout([{ product: product._id, quantity: 2, price: 1 }], 'TEST10'),
      'customer',
      201,
      { 'Idempotency-Key': key },
    )
  ).order;
  assert.equal(order.subtotal, 1000);
  assert.equal(order.discount, 100);
  assert.equal(order.total, 900);
  assert.equal(order.items[0].cost, undefined);
  assert.equal((await Product.findById(product._id)).stock, 8);
  const replay = (
    await expect(
      '/checkout',
      'POST',
      checkout([{ product: product._id, quantity: 2 }], 'TEST10'),
      'customer',
      200,
      { 'Idempotency-Key': key },
    )
  ).order;
  assert.equal(replay._id, order._id);
  assert.equal((await Product.findById(product._id)).stock, 8);
  assert.equal((await Coupon.findById(coupon._id)).used, 1);
});
test('checkout rejects invalid quantities and rolls back earlier reservations on failure', async () => {
  await expect(
    '/checkout',
    'POST',
    checkout([{ product: product._id, quantity: -1 }]),
    'customer',
    400,
    { 'Idempotency-Key': randomUUID() },
  );
  await expect(
    '/checkout',
    'POST',
    checkout(
      [
        { product: product._id, quantity: 1 },
        { product: variantProduct._id, variantId: variantProduct.variants[0]._id, quantity: 20 },
      ],
      'TEST10',
    ),
    'customer',
    409,
    { 'Idempotency-Key': randomUUID() },
  );
  assert.equal((await Product.findById(product._id)).stock, 8);
  assert.equal((await Coupon.findById(coupon._id)).used, 1);
  await expect(
    '/checkout',
    'POST',
    checkout([
      { product: product._id, quantity: 1 },
      { product: product._id, quantity: 1 },
    ]),
    'customer',
    400,
    { 'Idempotency-Key': randomUUID() },
  );
});
test('concurrent checkouts cannot oversell a product', async () => {
  const scarce = await Product.create({
    business: business._id,
    category: category._id,
    name: 'Scarce Product',
    price: 100,
    cost: 20,
    stock: 1,
  });
  const attempts = await Promise.all([
    request('/checkout', 'POST', checkout([{ product: scarce.id, quantity: 1 }]), 'customer', {
      'Idempotency-Key': randomUUID(),
    }),
    request('/checkout', 'POST', checkout([{ product: scarce.id, quantity: 1 }]), 'customer2', {
      'Idempotency-Key': randomUUID(),
    }),
  ]);
  assert.deepEqual(attempts.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await Product.findById(scarce.id)).stock, 0);
});
test('customer and seller order access is scoped', async () => {
  await expect('/orders/' + order._id, 'GET', undefined, 'customer2', 403);
  await expect('/orders/' + order._id, 'GET', undefined, 'seller2', 403);
  const mine = await expect('/orders', 'GET', undefined, 'customer', 200);
  assert.equal(mine.orders.find((o) => o._id === order._id).items[0].cost, undefined);
  await expect(
    '/orders/' + order._id + '/status',
    'PATCH',
    { business: business._id, status: 'confirmed' },
    'seller2',
    403,
  );
});
test('reviews require delivery and order states cannot skip steps', async () => {
  await expect(
    '/products/' + product._id + '/reviews',
    'POST',
    { rating: 5, comment: 'Great product' },
    'customer',
    403,
  );
  await expect(
    '/orders/' + order._id + '/status',
    'PATCH',
    { business: business._id, status: 'delivered' },
    'seller',
    400,
  );
  for (const status of ['confirmed', 'processing', 'shipped', 'delivered'])
    await expect(
      '/orders/' + order._id + '/status',
      'PATCH',
      {
        business: business._id,
        status,
        trackingNumber: status === 'shipped' ? 'TEST-TRACK-01' : '',
      },
      'seller',
      200,
    );
  await expect(
    '/products/' + product._id + '/reviews',
    'POST',
    { rating: 5, comment: 'Great product, delivered on time' },
    'customer',
    201,
  );
  await expect(
    '/products/' + product._id + '/reviews',
    'POST',
    { rating: 4, comment: 'Updated review, still a good product' },
    'customer',
    201,
  );
  assert.equal(await Review.countDocuments({ product: product._id }), 1);
  assert.equal((await Product.findById(product._id)).rating, 4);
  const stored = await Order.findById(order._id);
  assert.equal(stored.fulfillments[0].events.length, 5);
});
test('variant stock is reserved and cancellation restores it exactly once', async () => {
  const variantId = variantProduct.variants[0]._id;
  const placed = (
    await expect(
      '/checkout',
      'POST',
      checkout([{ product: variantProduct._id, variantId, quantity: 2 }]),
      'customer',
      201,
      { 'Idempotency-Key': randomUUID() },
    )
  ).order;
  assert.equal((await Product.findById(variantProduct._id)).variants[0].stock, 3);
  await expect(
    '/orders/' + placed._id + '/status',
    'PATCH',
    { business: business._id, status: 'cancelled' },
    'customer',
    200,
  );
  await expect(
    '/orders/' + placed._id + '/status',
    'PATCH',
    { business: business._id, status: 'cancelled' },
    'customer',
    400,
  );
  assert.equal((await Product.findById(variantProduct._id)).variants[0].stock, 5);
});
test('multi-store orders expose only a sellers own line items and totals', async () => {
  const secondProduct = await Product.create({
    business: secondBusiness._id,
    category: category._id,
    name: 'Second Shop Item',
    price: 700,
    cost: 400,
    stock: 3,
  });
  const placed = (
    await expect(
      '/checkout',
      'POST',
      checkout([
        { product: product._id, quantity: 1 },
        { product: secondProduct.id, quantity: 1 },
      ]),
      'customer',
      201,
      { 'Idempotency-Key': randomUUID() },
    )
  ).order;
  const scoped = (await expect('/orders/' + placed._id, 'GET', undefined, 'seller2', 200)).order;
  assert.equal(scoped.items.length, 1);
  assert.equal(scoped.total, 700);
  assert.equal(scoped.fulfillments.length, 1);
});
test('expenses and delivered-only analytics calculate profit correctly', async () => {
  await expect(
    '/seller/expenses',
    'POST',
    { title: 'Test marketing', category: 'marketing', amount: 100, date: new Date().toISOString() },
    'seller',
    201,
  );
  const data = (await expect('/seller/analytics', 'GET', undefined, 'seller', 200)).analytics;
  assert.equal(data.revenue, 900);
  assert.equal(data.cost, 400);
  assert.equal(data.expenses, 100);
  assert.equal(data.profit, 400);
  assert.equal(
    data.health.score,
    data.health.components.reduce((sum, component) => sum + component.earned, 0),
  );
  await expect('/seller/reports/export', 'GET', undefined, 'seller', 200);
});
test('reports reach admin, resolve and create private notifications', async () => {
  const report = (
    await expect(
      '/reports',
      'POST',
      { business: business._id, reason: 'Test concern about store communication' },
      'customer',
      201,
    )
  ).report;
  await expect(
    '/admin/reports/' + report._id,
    'PATCH',
    { status: 'resolved', resolution: 'Reviewed and addressed' },
    'admin',
    200,
  );
  const data = await expect('/notifications', 'GET', undefined, 'customer', 200);
  assert.ok(data.unread > 0);
  assert.ok(data.notifications.every((n) => n.user === users.customer.id));
  await expect('/notifications/read', 'PATCH', {}, 'customer', 200);
  assert.equal(await Notification.countDocuments({ user: users.customer.id, read: false }), 0);
  await expect('/admin/overview', 'GET', undefined, 'admin', 200);
});
test('suspended accounts lose access and business changes require new verification', async () => {
  await expect(
    '/admin/users/' + users.customer2.id,
    'PATCH',
    { status: 'suspended' },
    'admin',
    200,
  );
  await expect('/auth/me', 'GET', undefined, 'customer2', 401);
  await expect(
    '/auth/login',
    'POST',
    { email: 'customer2@test.example', password: 'TestSecret123!' },
    undefined,
    403,
  );
  await expect('/seller/business', 'PATCH', { name: 'Changed Business' }, 'seller', 200);
  assert.equal((await Business.findById(business._id)).verification, 'pending');
  await expect('/products/' + product._id, 'GET', undefined, undefined, 404);
});
test('logout invalidates previously issued JWT sessions', async () => {
  await expect('/auth/logout', 'POST', {}, 'customer', 200);
  await expect('/auth/me', 'GET', undefined, 'customer', 401);
});

test('quote confirms discounts without reserving stock and stale prices are rejected', async () => {
  await Business.updateOne({ _id: business._id }, { $set: { verification: 'approved' } });
  const before = await Product.findById(product._id);
  await expect(
    '/checkout/quote',
    'POST',
    { items: [{ product: product._id, quantity: 1 }], couponCode: 'TEST10' },
    'customer2',
    401,
  );
  // Use a fresh session for a reactivated customer.
  await expect('/admin/users/' + users.customer2.id, 'PATCH', { status: 'active' }, 'admin', 200);
  const login = await request('/auth/login', 'POST', {
    email: 'customer2@test.example',
    password: 'TestSecret123!',
  });
  cookies.customer2 = login.cookie.split(';')[0];
  const data = (
    await expect(
      '/checkout/quote',
      'POST',
      { items: [{ product: product._id, quantity: 1 }], couponCode: 'TEST10' },
      'customer2',
      200,
    )
  ).quote;
  assert.equal(data.total, 450);
  assert.equal(data.items[0].cost, undefined);
  assert.equal((await Product.findById(product._id)).stock, before.stock);
  await expect(
    '/checkout',
    'POST',
    { ...checkout([{ product: product._id, quantity: 1 }], 'TEST10'), expectedTotal: 1 },
    'customer2',
    409,
    { 'Idempotency-Key': randomUUID() },
  );
  assert.equal((await Product.findById(product._id)).stock, before.stock);
});
test('different variants of the same product can be purchased together', async () => {
  const current = await Product.findById(variantProduct._id);
  const updated = (
    await expect(
      '/seller/products/' + current.id,
      'PATCH',
      {
        version: current.__v,
        variants: [
          ...current.variants.map((v) => v.toObject()),
          { name: 'Large', sku: 'LARGE', price: 700, cost: 300, stock: 4 },
        ],
      },
      'seller',
      200,
    )
  ).product;
  const placed = (
    await expect(
      '/checkout',
      'POST',
      checkout(
        updated.variants.map((v) => ({ product: updated._id, variantId: v._id, quantity: 1 })),
      ),
      'customer2',
      201,
      { 'Idempotency-Key': randomUUID() },
    )
  ).order;
  assert.equal(placed.items.length, 2);
  assert.equal(placed.total, 1300);
  const stored = await Product.findById(updated._id);
  assert.deepEqual(
    stored.variants.map((v) => v.stock),
    [4, 3],
  );
  await expect(
    '/seller/products/' + stored.id,
    'PATCH',
    { version: stored.__v, variants: [] },
    'seller',
    400,
  );
  await expect(
    '/orders/' + placed._id + '/status',
    'PATCH',
    { business: business._id, status: 'cancelled' },
    'customer2',
    200,
  );
  const cancelled = (await expect('/orders/' + placed._id, 'GET', undefined, 'customer2', 200))
    .order;
  assert.equal(cancelled.payableTotal, 0);
  assert.deepEqual(
    (await Product.findById(updated._id)).variants.map((v) => v.stock),
    [5, 4],
  );
});
test('production checkout requires and uses replica-set transactions', async () => {
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  const before = await Product.findById(product._id);
  try {
    process.env.NODE_ENV = 'production';
    await expect(
      '/checkout',
      'POST',
      checkout([{ product: product._id, quantity: 1 }]),
      'customer2',
      topology.setName ? 201 : 503,
      { 'Idempotency-Key': randomUUID() },
    );
    assert.equal(
      (await Product.findById(product._id)).stock,
      before.stock - (topology.setName ? 1 : 0),
    );
  } finally {
    process.env.NODE_ENV = 'test';
  }
});

test('suspended sellers disappear publicly and cannot receive new orders', async () => {
  await expect('/admin/users/' + users.seller.id, 'PATCH', { status: 'suspended' }, 'admin', 200);
  await expect('/products/' + product._id, 'GET', undefined, undefined, 404);
  await expect('/stores/test-store', 'GET', undefined, undefined, 404);
  await expect(
    '/checkout',
    'POST',
    checkout([{ product: product._id, quantity: 1 }]),
    'customer2',
    409,
    { 'Idempotency-Key': randomUUID() },
  );
  await expect('/admin/users/' + users.seller.id, 'PATCH', { status: 'active' }, 'admin', 200);
  await expect('/products/' + product._id, 'GET', undefined, undefined, 200);
});

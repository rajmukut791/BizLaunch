const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
require('../config/env')();
process.env.NODE_ENV = 'test';
process.env.CLIENT_ORIGINS = 'http://localhost:5199';
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
    emailVerified: true,
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
test('registration requires email verification before creating private cookie sessions', async () => {
  for (const role of ['seller', 'seller2', 'customer', 'customer2']) {
    let result = await request('/auth/register', 'POST', {
      name: 'Test ' + role,
      email: role + '@test.example',
      password: 'TestSecret123!',
      role: role.startsWith('seller') ? 'seller' : 'customer',
    });
    assert.equal(result.status, 201);
    assert.equal(result.cookie, null);
    const address = role + '@test.example';
    await expect(
      '/auth/login',
      'POST',
      { email: address, password: 'TestSecret123!' },
      undefined,
      403,
    );
    const delivery = require('../services/mail').testDelivery(address);
    await expect('/auth/verify-email', 'POST', { token: delivery.token }, undefined, 200);
    await expect('/auth/verify-email', 'POST', { token: delivery.token }, undefined, 400);
    result = await request('/auth/login', 'POST', { email: address, password: 'TestSecret123!' });
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
        paymentConfirmed: status === 'delivered',
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

test('password reset is private, single-use and invalidates existing sessions', async () => {
  const address = 'reset@test.example';
  await User.create({
    name: 'Reset User',
    email: address,
    password: 'OldSecret123!',
    emailVerified: true,
  });
  const login = await request('/auth/login', 'POST', { email: address, password: 'OldSecret123!' });
  const cookie = login.cookie.split(';')[0];
  const known = await expect('/auth/forgot-password', 'POST', { email: address }, undefined, 200);
  const unknown = await expect(
    '/auth/forgot-password',
    'POST',
    { email: 'unknown@test.example' },
    undefined,
    200,
  );
  assert.deepEqual(known, unknown);
  const token = require('../services/mail').testDelivery(address).token;
  await expect(
    '/auth/reset-password',
    'POST',
    { token, password: 'NewSecret123!' },
    undefined,
    200,
  );
  await expect(
    '/auth/reset-password',
    'POST',
    { token, password: 'OtherSecret123!' },
    undefined,
    400,
  );
  await expect('/auth/me', 'GET', undefined, undefined, 401, { Cookie: cookie });
  await expect(
    '/auth/login',
    'POST',
    { email: address, password: 'OldSecret123!' },
    undefined,
    401,
  );
  await expect(
    '/auth/login',
    'POST',
    { email: address, password: 'NewSecret123!' },
    undefined,
    200,
  );
});

test('expired verification tokens cannot grant access', async () => {
  const address = 'expired@test.example';
  await expect(
    '/auth/register',
    'POST',
    { name: 'Expired User', email: address, password: 'SecretPassword123!' },
    undefined,
    201,
  );
  const token = require('../services/mail').testDelivery(address).token;
  await User.updateOne(
    { email: address },
    { $set: { verificationExpiresAt: new Date(Date.now() - 1000) } },
  );
  await expect('/auth/verify-email', 'POST', { token }, undefined, 400);
  await expect(
    '/auth/login',
    'POST',
    { email: address, password: 'SecretPassword123!' },
    undefined,
    403,
  );
  await expect('/auth/verify-email', 'POST', { token: 'bad' }, undefined, 400);
});

test('additional trusted frontend origins are allowed while unknown origins remain blocked', async () => {
  const origin = 'http://localhost:5199';
  const response = await fetch(base + '/auth/verify-email', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'invalid' }),
  });
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  await expect('/auth/verify-email', 'POST', { token: 'invalid' }, undefined, 403, {
    Origin: 'https://untrusted.example',
  });
});

test('maintenance is admin-only, blocks commerce, preserves authentication and automatically reopens', async () => {
  const Settings = require('../models/PlatformSettings');
  const initial = (await expect('/admin/maintenance', 'GET', undefined, 'admin', 200)).maintenance;
  const values = {
    enabled: true,
    title: 'A little care. A better marketplace.',
    message: 'We are improving your experience. Please check back soon.',
    endsAt: new Date(Date.now() + 3600000).toISOString(),
    version: initial.version,
  };
  const login = await request('/auth/login', 'POST', {
    email: 'customer2@test.example',
    password: 'TestSecret123!',
  });
  assert.equal(login.status, 200);
  const customerCookie = login.cookie.split(';')[0];
  await expect('/admin/maintenance', 'PATCH', values, undefined, 401);
  await expect('/admin/maintenance', 'PATCH', values, undefined, 403, { Cookie: customerCookie });
  await expect('/admin/maintenance', 'PATCH', { ...values, enabled: 'true' }, 'admin', 400);
  await expect('/admin/maintenance', 'PATCH', { ...values, endsAt: 'yesterday' }, 'admin', 400);
  try {
    const updated = (await expect('/admin/maintenance', 'PATCH', values, 'admin', 200)).maintenance;
    assert.equal(updated.enabled, true);
    assert.equal(updated.history.length, 1);
    assert.equal(updated.history[0].changedBy.name, 'Test Admin');
    const publicState = (await expect('/platform/status', 'GET', undefined, undefined, 200))
      .maintenance;
    assert.equal(publicState.enabled, true);
    assert.equal(publicState.history, undefined);
    const blocked = await fetch(base + '/products');
    assert.equal(blocked.status, 503);
    assert.ok(Number(blocked.headers.get('retry-after')) > 0);
    assert.equal((await blocked.json()).code, 'MAINTENANCE');
    await expect('/checkout', 'POST', {}, undefined, 503, { Cookie: customerCookie });
    await expect('/auth/me', 'GET', undefined, undefined, 200, { Cookie: customerCookie });
    await expect('/admin/overview', 'GET', undefined, 'admin', 200);
    await expect('/products', 'GET', undefined, 'admin', 200);
    const unverified = await User.create({
      name: 'Unverified Admin',
      email: 'unverified-admin@test.example',
      role: 'admin',
      password: 'TestSecret123!',
    });
    const token = require('jsonwebtoken').sign(
      { userId: unverified.id, version: unverified.tokenVersion },
      process.env.JWT_SECRET,
      { algorithm: 'HS256' },
    );
    await expect('/products', 'GET', undefined, undefined, 503, {
      Cookie: 'bizlaunch_session=' + token,
    });
    await expect('/admin/maintenance', 'PATCH', { ...values, enabled: false }, 'admin', 409);
    await Settings.updateOne(
      { _id: 'platform' },
      { $set: { endsAt: new Date(Date.now() - 1000) } },
    );
    const resumed = (await expect('/platform/status', 'GET', undefined, undefined, 200))
      .maintenance;
    assert.equal(resumed.enabled, false);
    await expect('/products', 'GET', undefined, undefined, 200);
    const log = (await expect('/admin/maintenance', 'GET', undefined, 'admin', 200)).maintenance;
    assert.equal(log.history.length, 2);
    assert.equal(log.history[1].changedBy, null);
  } finally {
    await Settings.updateOne({ _id: 'platform' }, { $set: { enabled: false, endsAt: null } });
  }
});

test('orders paginate and search safely with inclusive Bangladesh date boundaries', async () => {
  const template = await Order.findById(order._id).lean();
  const fixtures = [];
  for (let i = 0; i < 7; i++)
    fixtures.push({
      ...template,
      _id: new mongoose.Types.ObjectId(),
      number: 'FILTER-' + i,
      checkoutKey: 'filter-' + i,
      createdAt: new Date('2026-01-01T18:00:00Z'),
      updatedAt: new Date(),
      refunds: [],
    });
  fixtures.push({
    ...template,
    _id: new mongoose.Types.ObjectId(),
    number: 'FILTER-OUTSIDE',
    checkoutKey: 'filter-outside',
    createdAt: new Date('2026-01-02T18:00:00Z'),
    refunds: [],
  });
  await Order.collection.insertMany(fixtures);
  const page1 = await expect(
    '/orders?q=FILTER-&from=2026-01-02&to=2026-01-02&limit=5',
    'GET',
    undefined,
    'admin',
    200,
  );
  assert.equal(page1.total, 7);
  assert.equal(page1.orders.length, 5);
  assert.equal(page1.pages, 2);
  const page2 = await expect(
    '/orders?q=FILTER-&from=2026-01-02&to=2026-01-02&limit=5&page=2',
    'GET',
    undefined,
    'admin',
    200,
  );
  assert.equal(page2.orders.length, 2);
  assert.ok(page2.orders.every((row) => !page1.orders.some((other) => other._id === row._id)));
  assert.equal((await expect('/orders?q=%5B', 'GET', undefined, 'admin', 200)).total, 0);
  assert.ok(
    (await expect('/orders?q=customer%40test.example', 'GET', undefined, 'admin', 200)).total > 0,
  );
  for (const query of [
    'from=2026-02-30',
    'from=2026-02-01&to=2026-01-01',
    'limit=0',
    'page=abc',
    'status=bogus',
    'refund=bogus',
    'sort=bogus',
  ])
    await expect('/orders?' + query, 'GET', undefined, 'admin', 400);
  await Order.deleteMany({ _id: { $in: fixtures.map((f) => f._id) } });
});
test('refund review enforces ownership, eligibility, duplicate protection and payout accounting', async () => {
  for (const role of ['customer', 'customer2', 'seller', 'seller2']) {
    const login = await request('/auth/login', 'POST', {
      email: role + '@test.example',
      password: 'TestSecret123!',
    });
    assert.equal(login.status, 200);
    cookies[role] = login.cookie.split(';')[0];
  }
  const target = await Order.findById(order._id);
  const body = {
    business: String(business._id),
    amount: 10,
    reason: 'Product arrived with a damaged finish.',
  };
  const path = '/orders/' + target.id + '/refunds';
  await expect(path, 'POST', body, 'seller', 403);
  await expect(path, 'POST', body, 'customer2', 403);
  await expect(path, 'POST', { ...body, amount: 1000000 }, 'customer', 400);
  const pending = await Order.findOne({
    'fulfillments.status': { $ne: 'delivered' },
    customer: target.customer,
  });
  if (pending) await expect('/orders/' + pending.id + '/refunds', 'POST', body, 'customer', 400);
  const before = (await expect('/seller/analytics', 'GET', undefined, 'seller', 200)).analytics;
  const stockBefore = (await Product.findById(product._id)).stock;
  const submissions = await Promise.all([
    request(path, 'POST', body, 'customer'),
    request(path, 'POST', body, 'customer'),
  ]);
  assert.deepEqual(submissions.map((r) => r.status).sort(), [201, 409]);
  const detail = (await expect('/orders/' + target.id, 'GET', undefined, 'admin', 200)).order;
  const refund = detail.refunds[0],
    review = path + '/' + refund._id;
  await expect(
    review,
    'PATCH',
    { status: 'approved', note: 'Eligible damaged product refund.', version: 0 },
    'seller',
    403,
  );
  await expect(
    review,
    'PATCH',
    { status: 'completed', note: 'Paid already', version: 0 },
    'admin',
    409,
  );
  await expect(
    review,
    'PATCH',
    { status: 'approved', note: 'Eligible damaged product refund.', version: 0 },
    'admin',
    200,
  );
  await expect(
    review,
    'PATCH',
    { status: 'rejected', note: 'Stale decision', version: 0 },
    'admin',
    409,
  );
  assert.equal(
    (await expect('/seller/analytics', 'GET', undefined, 'seller', 200)).analytics.revenue,
    before.revenue,
  );
  const payout = {
    status: 'completed',
    note: 'Cash returned to the customer.',
    version: 1,
    payoutMethod: 'cash',
    payoutReference: 'RECEIPT-TEST-001',
  };
  await expect(review, 'PATCH', payout, 'admin', 400);
  const payments = await Promise.all([
    request(review, 'PATCH', { ...payout, paymentConfirmed: true }, 'admin'),
    request(review, 'PATCH', { ...payout, paymentConfirmed: true }, 'admin'),
  ]);
  assert.deepEqual(payments.map((r) => r.status).sort(), [200, 409]);
  const after = (await expect('/seller/analytics', 'GET', undefined, 'seller', 200)).analytics;
  assert.equal(after.revenue, before.revenue - 10);
  assert.equal(after.profit, before.profit - 10);
  assert.equal(after.cost, before.cost);
  assert.equal((await Product.findById(product._id)).stock, stockBefore);
  const completed = (await expect('/orders/' + target.id, 'GET', undefined, 'customer', 200)).order;
  assert.equal(completed.refundedTotal, 10);
  assert.equal(completed.refunds[0].events.length, 3);
  assert.equal(
    (await expect('/orders?refund=completed', 'GET', undefined, 'seller2', 200)).orders.some(
      (row) => row.refunds.some((r) => r._id === refund._id),
    ),
    false,
  );
  assert.ok(
    (await expect('/orders?refund=completed', 'GET', undefined, 'admin', 200)).orders.some(
      (row) => row._id === target.id,
    ),
  );
});

test('wishlist is private and idempotent; review moderation updates public ratings', async () => {
  await expect(
    '/admin/businesses/' + String(business._id),
    'PATCH',
    { verification: 'approved', active: true, note: 'Approved test store' },
    'admin',
    200,
  );
  const login = await request('/auth/login', 'POST', {
    email: 'customer@test.example',
    password: 'TestSecret123!',
  });
  cookies.customer = login.cookie.split(';')[0];
  await expect('/wishlist/' + String(product._id), 'PUT', {}, 'customer', 200);
  await expect('/wishlist/' + String(product._id), 'PUT', {}, 'customer', 200);
  assert.equal(
    (await expect('/wishlist', 'GET', undefined, 'customer', 200)).products.filter(
      (p) => p._id === String(product._id),
    ).length,
    1,
  );
  assert.equal((await expect('/wishlist', 'GET', undefined, 'customer2', 200)).products.length, 0);
  await expect('/wishlist', 'GET', undefined, 'seller', 403);
  const review = await Review.findOne({ product: product._id });
  await expect(
    '/seller/reviews/' + review.id + '/reply',
    'PATCH',
    { reply: 'Thank you for supporting our business.' },
    'seller',
    200,
  );
  await expect(
    '/seller/reviews/' + review.id + '/reply',
    'PATCH',
    { reply: 'Cannot manage this store.' },
    'seller2',
    404,
  );
  await expect(
    '/admin/reviews/' + review.id,
    'PATCH',
    { hidden: true, note: 'Review hidden for moderation test.' },
    'admin',
    200,
  );
  assert.equal(
    (await expect('/products/' + String(product._id), 'GET', undefined, undefined, 200)).product
      .reviewCount,
    0,
  );
  await expect(
    '/admin/reviews/' + review.id,
    'PATCH',
    { hidden: false, note: 'Review restored after checking.' },
    'admin',
    200,
  );
  assert.equal(
    (await expect('/products/' + String(product._id), 'GET', undefined, undefined, 200)).product
      .reviewCount,
    1,
  );
  const customers = await expect('/seller/customers?q=customer', 'GET', undefined, 'seller', 200);
  assert.ok(customers.summary.total >= 1);
  assert.ok(customers.customers.every((c) => Number.isFinite(c.purchase)));
  const insights = await expect('/seller/insights', 'GET', undefined, 'seller', 200);
  assert.equal(insights.insights.range.timezone, 'Asia/Dhaka');
  assert.ok(insights.insights.topProducts.length);
  await expect('/seller/insights?from=2026-02-30', 'GET', undefined, 'seller', 400);
});
test('inventory changes retain a scoped ledger and reject stale or negative stock', async () => {
  const current = await Product.findById(String(product._id)),
    before = current.stock;
  await expect(
    '/seller/inventory/' + String(product._id) + '/adjust',
    'POST',
    { delta: 4, type: 'PURCHASE', note: 'New purchase received.', version: current.__v },
    'seller',
    200,
  );
  await expect(
    '/seller/inventory/' + String(product._id) + '/adjust',
    'POST',
    { delta: 4, type: 'PURCHASE', note: 'Stale stock change.', version: current.__v },
    'seller',
    409,
  );
  const updated = await Product.findById(String(product._id));
  assert.equal(updated.stock, before + 4);
  await expect(
    '/seller/inventory/' + String(product._id) + '/adjust',
    'POST',
    { delta: -100000, type: 'ADJUSTMENT', note: 'Invalid stock change.', version: updated.__v },
    'seller',
    400,
  );
  await expect(
    '/seller/inventory/' + String(product._id) + '/adjust',
    'POST',
    { delta: 2, type: 'PURCHASE', note: 'Other store access.', version: updated.__v },
    'seller2',
    404,
  );
  const history = await expect(
    '/seller/inventory/history?product=' + String(product._id),
    'GET',
    undefined,
    'seller',
    200,
  );
  assert.ok(history.movements.some((m) => m.entry.type === 'SALE'));
  assert.ok(
    (await expect('/seller/inventory/history?type=RETURN', 'GET', undefined, 'seller', 200))
      .movements.length,
  );
  assert.equal(history.movements[0].entry.after, before + 4);
  assert.equal(
    (
      await expect(
        '/seller/inventory/history?product=' + String(product._id),
        'GET',
        undefined,
        'seller2',
        200,
      )
    ).total,
    0,
  );
});
test('staff invitations require the invited verified email and enforce inventory-only access', async () => {
  const Member = require('../models/BusinessMember');
  await Member.init();
  const staff = await User.create({
    name: 'Inventory Colleague',
    email: 'staff@test.example',
    password: 'TestSecret123!',
    role: 'customer',
    emailVerified: true,
  });
  const login = await request('/auth/login', 'POST', {
    email: staff.email,
    password: 'TestSecret123!',
  });
  cookies.staff = login.cookie.split(';')[0];
  await expect('/seller/team', 'POST', { email: staff.email, job: 'inventory' }, 'seller', 201);
  const delivery = require('../services/mail').testDelivery(staff.email);
  await expect('/team-invites/accept', 'POST', { token: delivery.token }, 'customer', 400);
  await expect('/team-invites/accept', 'POST', { token: delivery.token }, 'staff', 200);
  await expect('/profile', 'GET', undefined, 'staff', 401);
  const signed = await request('/auth/login', 'POST', {
    email: staff.email,
    password: 'TestSecret123!',
  });
  cookies.staff = signed.cookie.split(';')[0];
  assert.equal(signed.data.user.role, 'staff');
  assert.deepEqual(signed.data.user.permissions, ['inventory']);
  await expect('/seller/analytics', 'GET', undefined, 'staff', 403);
  await expect('/orders', 'GET', undefined, 'staff', 403);
  await expect('/seller/team', 'GET', undefined, 'staff', 403);
  await expect('/seller/expenses', 'GET', undefined, 'staff', 403);
  const products = (await expect('/seller/products', 'GET', undefined, 'staff', 200)).products;
  assert.equal(products[0].cost, undefined);
  const current = await Product.findById(String(product._id));
  await expect(
    '/seller/inventory/' + String(product._id) + '/adjust',
    'POST',
    { delta: 1, type: 'PURCHASE', note: 'Staff inspected delivery.', version: current.__v },
    'staff',
    200,
  );
  await expect(
    '/seller/products/' + String(product._id),
    'PATCH',
    { name: 'Unauthorized edit', version: current.__v },
    'staff',
    403,
  );
  const member = await Member.findOne({ user: staff._id, status: 'active' });

  await expect('/seller/team/' + member.id, 'PATCH', { job: 'manager' }, 'seller', 200);
  const managerLogin = await request('/auth/login', 'POST', {
    email: staff.email,
    password: 'TestSecret123!',
  });
  cookies.staff = managerLogin.cookie.split(';')[0];
  assert.equal(
    (await expect('/seller/business', 'GET', undefined, 'staff', 200)).business._id,
    String(business._id),
  );
  await expect(
    '/seller/business',
    'POST',
    {
      name: 'Unauthorized extra store',
      slug: 'unauthorized-extra',
      phone: '01712345678',
      address: 'Test Address',
    },
    'staff',
    403,
  );
  await expect('/seller/team/' + member.id, 'PATCH', { status: 'revoked' }, 'seller', 200);
  await expect('/seller/products', 'GET', undefined, 'staff', 401);
});

test('fixed coupons enforce start dates, allocated discounts and editable unused terms', async () => {
  const created = await expect(
    '/seller/coupons',
    'POST',
    {
      code: 'FIXEDTEST',
      discountType: 'fixed',
      discountValue: 50,
      minimum: 0,
      limit: 5,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
    'seller',
    201,
  );
  const quote = await expect(
    '/checkout/quote',
    'POST',
    { items: [{ product: product._id, quantity: 1 }], couponCode: 'FIXEDTEST' },
    'customer',
    200,
  );
  assert.equal(quote.quote.discount, 50);
  const scheduled = await expect(
    '/seller/coupons',
    'POST',
    {
      code: 'LATERTEST',
      percent: 10,
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    },
    'seller',
    201,
  );
  await expect(
    '/checkout/quote',
    'POST',
    { items: [{ product: product._id, quantity: 1 }], couponCode: 'LATERTEST' },
    'customer',
    400,
  );
  await expect(
    '/seller/coupons/' + created.coupon._id,
    'PATCH',
    {
      code: 'FIXEDTEST',
      discountType: 'fixed',
      discountValue: 60,
      minimum: 0,
      limit: 5,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      version: created.coupon.__v,
    },
    'seller',
    200,
  );
  await expect('/seller/coupons/' + created.coupon._id, 'DELETE', {}, 'seller2', 409);
  await expect('/seller/coupons/' + created.coupon._id, 'DELETE', {}, 'seller', 200);
  await expect('/seller/coupons/' + scheduled.coupon._id, 'DELETE', {}, 'seller', 200);
});
test('inspected returns restore stock once and reverse product costs without inventing a refund', async () => {
  const target = await Order.findById(order._id),
    businessId = String(business._id),
    path = '/orders/' + target.id + '/returns';
  const body = { business: businessId, reason: 'Items returned for inspection and replacement.' };
  await expect(path, 'POST', body, 'customer2', 403);
  await expect(path, 'POST', body, 'customer', 201);
  await expect(path, 'POST', body, 'customer', 409);
  const entry = (await Order.findById(target.id)).returns[0],
    review = path + '/' + entry.id;
  await expect(
    review,
    'PATCH',
    { status: 'approved', note: 'Approved return for inspection.', version: 0 },
    'seller2',
    403,
  );
  await expect(
    review,
    'PATCH',
    { status: 'approved', note: 'Approved return for inspection.', version: 0 },
    'seller',
    200,
  );
  const before = (await expect('/seller/analytics', 'GET', undefined, 'seller', 200)).analytics;
  const stock = (await Product.findById(product._id)).stock;
  const received = {
    status: 'received',
    note: 'All items received in saleable condition.',
    version: 1,
    restock: true,
  };
  await expect(review, 'PATCH', received, 'seller', 400);
  const receipts = await Promise.all([
    request(review, 'PATCH', { ...received, receivedConfirmed: true }, 'seller'),
    request(review, 'PATCH', { ...received, receivedConfirmed: true }, 'seller'),
  ]);
  assert.deepEqual(receipts.map((r) => r.status).sort(), [200, 409]);
  const lines = target.items.filter((i) => String(i.business) === businessId),
    quantity = lines.reduce((sum, i) => sum + i.quantity, 0),
    cost = lines.reduce((sum, i) => sum + i.cost * i.quantity, 0);
  assert.equal((await Product.findById(product._id)).stock, stock + quantity);
  const after = (await expect('/seller/analytics', 'GET', undefined, 'seller', 200)).analytics;
  assert.equal(after.revenue, before.revenue);
  assert.equal(after.cost, before.cost - cost);
  assert.equal(after.profit, before.profit + cost);
  const detail = (await expect('/orders/' + target.id, 'GET', undefined, 'customer', 200)).order;
  assert.equal(detail.fulfillments[0].status, 'returned');
  assert.equal(detail.refundedTotal, 10);
  assert.ok(
    (await expect('/orders?status=returned', 'GET', undefined, 'admin', 200)).orders.some(
      (o) => o._id === target.id,
    ),
  );
});
test('cart snapshots are private and server priced; platform settings are admin-only and versioned', async () => {
  await expect(
    '/cart',
    'PUT',
    { items: [{ product: product._id, quantity: 2, price: 1 }] },
    'customer',
    200,
  );
  const cart = await expect('/cart', 'GET', undefined, 'customer', 200);
  assert.equal(cart.items[0].price, (await Product.findById(product._id)).price);
  assert.equal((await expect('/cart', 'GET', undefined, 'customer2', 200)).items.length, 0);
  await expect('/cart', 'GET', undefined, 'seller', 403);
  await expect(
    '/cart',
    'PUT',
    { items: [{ product: product._id, quantity: 101 }] },
    'customer',
    400,
  );
  const current = (await expect('/admin/settings', 'GET', undefined, 'admin', 200)).settings;
  await expect('/admin/settings', 'GET', undefined, 'customer', 403);
  const values = {
    platformName: 'BizLaunch',
    supportEmail: 'help@test.example',
    supportPhone: '01712345678',
    allowRegistration: false,
    version: current.version,
  };
  await expect('/admin/settings', 'PATCH', values, 'admin', 200);
  try {
    await expect('/admin/settings', 'PATCH', values, 'admin', 409);
    await expect(
      '/auth/register',
      'POST',
      { name: 'Paused registration', email: 'paused@test.example', password: 'TestSecret123!' },
      undefined,
      503,
    );
    assert.equal(
      (await expect('/platform/config', 'GET', undefined, undefined, 200)).config.allowRegistration,
      false,
    );
  } finally {
    const latest = (await expect('/admin/settings', 'GET', undefined, 'admin', 200)).settings;
    await expect(
      '/admin/settings',
      'PATCH',
      { ...values, allowRegistration: true, version: latest.version },
      'admin',
      200,
    );
  }
});

test('real-time notifications authenticate cookies and isolate each user room', async () => {
  const { io } = require('socket.io-client'),
    sockets = [];
  const connect = (cookie) =>
    new Promise((resolve, reject) => {
      const socket = io(base.replace('/api', ''), {
        transports: ['websocket'],
        extraHeaders: { Origin: process.env.CLIENT_URL, ...(cookie ? { Cookie: cookie } : {}) },
        reconnection: false,
        timeout: 3000,
      });
      sockets.push(socket);
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  try {
    await assert.rejects(connect(), /Authentication required/);
    const customer = await connect(cookies.customer),
      other = await connect(cookies.customer2),
      received = [];
    other.on('notification', (data) => received.push(data));
    const event = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Live notification not delivered')), 3000);
      customer.once('notification', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
    await require('../services/commerce').notify(
      users.customer.id,
      'Private socket test',
      'Only this account should receive this message.',
      '/notifications',
    );
    assert.equal((await event).title, 'Private socket test');
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(received.length, 0);
  } finally {
    for (const socket of sockets) socket.disconnect();
  }
});

const validateEnv = require('../config/env');
const mongoose = require('mongoose');
const User = require('../models/User');
const {
  Business,
  Category,
  Product,
  Order,
  Expense,
  Review,
  Coupon,
  Notification,
} = require('../models/commerce');
const connectDB = require('../config/db');
async function seed() {
  validateEnv();
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo seeding is disabled in production');
  await connectDB();
  const password = process.env.DEMO_PASSWORD || 'BizLaunch123!';
  async function account(name, email, role) {
    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role !== role)
        throw new Error('Demo email is already used by a different account type');
      return existing;
    }
    return User.create({
      name,
      email,
      role,
      password,
      phone: '01700000000',
      emailVerified:
        process.env.NODE_ENV === 'test' && /^bizlaunch_e2e_/.test(mongoose.connection.name),
    });
  }
  const admin = await account('Platform Admin', 'admin@bizlaunch.demo', 'admin');
  const seller = await account('Ayesha Rahman', 'seller@bizlaunch.demo', 'seller');
  const customer = await account('Rafi Ahmed', 'customer@bizlaunch.demo', 'customer');
  const categories = {};
  for (const name of [
    'Everyday essentials',
    'Home & living',
    'Tech & accessories',
    'Paper & creative',
  ]) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-$/, '');
    categories[name] = await Category.findOneAndUpdate(
      { slug },
      { $setOnInsert: { name, description: 'Thoughtful finds for ' + name.toLowerCase() } },
      { upsert: true, returnDocument: 'after' },
    );
  }
  let business = await Business.findOne({ owner: seller._id });
  if (!business)
    business = await Business.create({
      owner: seller._id,
      name: 'The Everyday Studio',
      slug: 'everyday-studio',
      description:
        'Thoughtful essentials for slower mornings, brighter workspaces and everyday adventures. Designed with care, made to stay.',
      phone: '01700000000',
      address: 'Banani, Dhaka, Bangladesh',
      verification: 'approved',
      verificationNote: 'Verified demo business',
    });
  const catalog = [
    [
      'Everyday Canvas Tote',
      'Everyday essentials',
      790,
      350,
      32,
      'bag',
      'A sturdy cotton canvas tote with roomy handles and a relaxed silhouette. Bring a little intention to your everyday carry.',
    ],
    [
      'Morning Ritual Mug',
      'Home & living',
      480,
      180,
      24,
      'mug',
      'A ceramic mug for slow mornings and long conversations. Warm tones, a comfortable handle, and a generous pour.',
    ],
    [
      'Wireless Studio Headphones',
      'Tech & accessories',
      2890,
      1600,
      18,
      'headphones',
      'Over-ear wireless headphones for your daily soundtrack. Comfortable cushions and a clean, understated design.',
    ],
    [
      'The Daily Planner',
      'Paper & creative',
      350,
      120,
      45,
      'notebook',
      'Make space for your ideas. An undated notebook with a linen-inspired cover for plans, sketches and the things that matter.',
    ],
    [
      'Minimal Desk Lamp',
      'Home & living',
      1490,
      780,
      12,
      'lamp',
      'A warm pool of light for your desk. A compact, timeless shape that makes workspaces feel a little more considered.',
    ],
    [
      'Everyday Classic Watch',
      'Tech & accessories',
      1890,
      950,
      8,
      'watch',
      'A quiet classic. A clean dial and a comfortable strap for your everyday routine.',
    ],
    [
      'Weekend Canvas Sneakers',
      'Everyday essentials',
      1690,
      850,
      0,
      'shoes',
      'Easy-going canvas sneakers for city walks and weekend wandering. Choose your fit and make them your own.',
    ],
    [
      'Little Green Companion',
      'Home & living',
      590,
      210,
      5,
      'plant',
      'A cheerful tabletop plant in a simple terracotta pot. An easy way to bring a little life into your space.',
    ],
    [
      'Ideas Pocket Journal',
      'Paper & creative',
      240,
      80,
      30,
      'notebook',
      'A pocket journal for the ideas that arrive when you least expect them.',
    ],
    [
      'Sandstone Coffee Cup',
      'Home & living',
      420,
      160,
      20,
      'mug',
      'An earthy ceramic cup with a tactile finish. A small everyday pleasure.',
    ],
    [
      'Olive Market Bag',
      'Everyday essentials',
      690,
      290,
      15,
      'bag',
      'A reusable companion for market visits, library afternoons and daily errands.',
    ],
    [
      'Focus Desk Light',
      'Home & living',
      1290,
      650,
      16,
      'lamp',
      'A considered task light for reading, making and working.',
    ],
  ];
  const products = [];
  for (const [name, category, price, cost, stock, image, description] of catalog) {
    const variants =
      image === 'shoes'
        ? [39, 40, 41, 42].map((size) => ({
            name: 'EU ' + size,
            sku: 'WCS-' + size,
            price,
            cost,
            stock: 10,
          }))
        : [];
    const product = await Product.findOneAndUpdate(
      { business: business._id, name },
      {
        $setOnInsert: {
          business: business._id,
          name,
          category: categories[category]._id,
          price,
          cost,
          stock,
          images: ['/demo/' + image + '.svg'],
          description,
          variants,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    products.push(product);
  }
  const now = new Date();
  for (let index = 0; index < 6; index++) {
    const product = products[index];
    const placed = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 5, 8));
    const delivered = new Date(placed.getTime() + 3 * 86400000);
    const quantity = index + 1;
    const order = await Order.findOneAndUpdate(
      { number: 'BL-DEMO-00' + (index + 1) },
      {
        $setOnInsert: {
          customer: customer._id,
          checkoutKey: 'seed-demo-' + index,
          number: 'BL-DEMO-00' + (index + 1),
          items: [
            {
              product: product._id,
              business: business._id,
              name: product.name,
              image: product.images[0],
              variantId: '',
              variantName: '',
              price: product.price,
              cost: product.cost,
              quantity,
              discount: 0,
            },
          ],
          shipping: {
            name: customer.name,
            phone: customer.phone,
            address: 'Dhanmondi Road 7',
            city: 'Dhaka',
            postalCode: '1209',
          },
          paymentMethod: 'cod',
          subtotal: product.price * quantity,
          discount: 0,
          total: product.price * quantity,
          fulfillments: [
            {
              business: business._id,
              status: 'delivered',
              paymentStatus: 'paid',
              collectedAmount: product.price * quantity,
              paidAt: delivered,
              paymentReference: 'DEMO-COD-' + index,
              trackingNumber: 'DEMO-' + index,
              events: [
                { status: 'placed', at: placed },
                { status: 'confirmed', at: placed },
                { status: 'processing', at: placed },
                { status: 'shipped', at: new Date(placed.getTime() + 86400000) },
                { status: 'delivered', at: delivered },
              ],
            },
          ],
          createdAt: placed,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    await Review.findOneAndUpdate(
      { customer: customer._id, product: product._id },
      {
        $setOnInsert: {
          customer: customer._id,
          product: product._id,
          rating: index % 2 ? 5 : 4,
          comment: 'A thoughtful everyday find. Arrived safely and just as described.',
        },
      },
      { upsert: true },
    );
    const ratings = await Review.aggregate([
      { $match: { product: product._id } },
      { $group: { _id: null, rating: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    await Product.updateOne(
      { _id: product._id },
      { $set: { rating: ratings[0].rating, reviewCount: ratings[0].count } },
    );
    await Expense.findOneAndUpdate(
      { business: business._id, title: 'Demo marketing · ' + placed.toISOString().slice(0, 7) },
      {
        $setOnInsert: {
          business: business._id,
          title: 'Demo marketing · ' + placed.toISOString().slice(0, 7),
          category: 'marketing',
          amount: 150 + index * 50,
          date: placed,
          note: 'Demo expense for monthly analytics',
        },
      },
      { upsert: true },
    );
  }
  await Coupon.findOneAndUpdate(
    { code: 'LAUNCH10' },
    {
      $setOnInsert: {
        code: 'LAUNCH10',
        business: business._id,
        percent: 10,
        minimum: 300,
        limit: 100,
        expiresAt: new Date(now.getTime() + 180 * 86400000),
      },
    },
    { upsert: true },
  );
  for (const [user, link] of [
    [seller, '/seller'],
    [customer, '/dashboard'],
    [admin, '/admin'],
  ]) {
    await Notification.findOneAndUpdate(
      { user: user._id, title: 'Welcome to BizLaunch' },
      {
        $setOnInsert: {
          user: user._id,
          title: 'Welcome to BizLaunch',
          message: 'Your demo workspace is ready to explore.',
          link,
        },
      },
      { upsert: true },
    );
  }
  console.log('Demo ready: admin@bizlaunch.demo, seller@bizlaunch.demo, customer@bizlaunch.demo');
  console.log('Password: use DEMO_PASSWORD if configured; otherwise BizLaunch123!');
}
module.exports = seed;
if (require.main === module)
  seed()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());

const User = require('../models/User');
const { Business, Product, Order, Expense, Notification } = require('../models/commerce');
const { fail, money } = require('../utils/validation');
async function ownedBusiness(user) {
  const business = await Business.findOne({ owner: user.id });
  if (!business) fail(404, 'Create your business first');
  return business;
}
async function notify(user, title, message, link) {
  // Notifications must not turn an already committed order into a failed request.
  try {
    await Notification.create({ user, title, message, link });
  } catch (error) {
    console.error('Notification delivery failed:', error.message);
  }
}
function publicProduct(product) {
  const result = product.toObject ? product.toObject() : { ...product };
  delete result.cost;
  if (result.business && typeof result.business === 'object') delete result.business.owner;
  result.variants = (result.variants || []).map(({ cost, ...variant }) => variant);
  return result;
}
async function analytics(business) {
  const [orders, expenses, products] = await Promise.all([
    Order.find({ 'fulfillments.business': business._id }).lean(),
    Expense.find({ business: business._id }).lean(),
    Product.find({ business: business._id, active: true }).lean(),
  ]);
  let revenue = 0,
    cost = 0,
    cancelled = 0,
    delivered = 0;
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
    return {
      key: date.toISOString().slice(0, 7),
      month: date.toLocaleString('en', { month: 'short', timeZone: 'UTC' }),
      revenue: 0,
      expenses: 0,
      cost: 0,
      profit: 0,
    };
  });
  for (const order of orders) {
    const fulfillment = order.fulfillments.find((f) => String(f.business) === business.id);
    if (fulfillment.status === 'cancelled') cancelled++;
    if (fulfillment.status !== 'delivered') continue;
    delivered++;
    const delivery = fulfillment.events.find((event) => event.status === 'delivered');
    const month = months.find(
      (m) => m.key === new Date(delivery?.at || order.updatedAt).toISOString().slice(0, 7),
    );
    for (const item of order.items.filter((item) => String(item.business) === business.id)) {
      const value = money(item.price * item.quantity - item.discount);
      revenue += value;
      cost += item.cost * item.quantity;
      if (month) {
        month.revenue += value;
        month.cost += item.cost * item.quantity;
      }
    }
  }
  const grossRevenue = money(revenue);
  let refunds = 0;
  for (const order of orders)
    for (const refund of order.refunds || []) {
      if (String(refund.business) !== business.id || refund.status !== 'completed') continue;
      refunds += refund.amount;
      revenue -= refund.amount;
      const month = months.find(
        (m) => m.key === new Date(refund.completedAt).toISOString().slice(0, 7),
      );
      if (month) month.revenue -= refund.amount;
    }
  const totalExpenses = money(expenses.reduce((sum, expense) => sum + expense.amount, 0));
  expenses.forEach((expense) => {
    const month = months.find((m) => m.key === new Date(expense.date).toISOString().slice(0, 7));
    if (month) month.expenses += expense.amount;
  });
  months.forEach((month) => {
    month.revenue = money(month.revenue);
    month.expenses = money(month.expenses);
    month.profit = money(month.revenue - month.cost - month.expenses);
  });
  const stock = (product) =>
    product.variants.length
      ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
      : product.stock;
  const lowStock = products
    .filter((product) => stock(product) <= 5)
    .map((product) => ({ _id: product._id, name: product.name, stock: stock(product) }));
  const rating =
    products.reduce((sum, p) => sum + p.rating * p.reviewCount, 0) /
    (products.reduce((sum, p) => sum + p.reviewCount, 0) || 1);
  const components = [
    {
      label: 'Business verification',
      earned: business.verification === 'approved' ? 20 : 0,
      possible: 20,
    },
    {
      label: 'Catalog availability',
      earned: products.length
        ? Math.round((20 * (products.length - lowStock.length)) / products.length)
        : 0,
      possible: 20,
    },
    {
      label: 'Order completion',
      earned: orders.length ? Math.round((20 * delivered) / orders.length) : 0,
      possible: 20,
    },
    { label: 'Customer satisfaction', earned: rating ? Math.round(rating * 4) : 0, possible: 20 },
    {
      label: 'Positive operating profit',
      earned: revenue - cost - totalExpenses > 0 ? 20 : 0,
      possible: 20,
    },
  ];
  return {
    grossRevenue,
    refunds: money(refunds),
    revenue: money(revenue),
    cost: money(cost),
    expenses: totalExpenses,
    profit: money(revenue - cost - totalExpenses),
    orders: orders.length,
    delivered,
    cancelled,
    products: products.length,
    lowStock,
    rating: money(rating),
    months,
    health: { score: components.reduce((sum, c) => sum + c.earned, 0), components },
  };
}
module.exports = { ownedBusiness, notify, publicProduct, analytics, businessIsPublic };

async function businessIsPublic(business) {
  return (
    business &&
    business.active &&
    business.verification === 'approved' &&
    !!(await User.exists({ _id: business.owner, role: 'seller', status: 'active' }))
  );
}

const User = require('../models/User');
const { Business, Product, Order, Expense, Notification } = require('../models/commerce');
const { fail, money } = require('../utils/validation');
async function ownedBusiness(user) {
  const business = user.staffBusiness
    ? await Business.findById(user.staffBusiness)
    : await Business.findOne({ owner: user.id });
  if (!business) fail(404, 'Create your business first');
  return business;
}
async function notify(user, title, message, link) {
  // Notifications must not turn an already committed order into a failed request.
  try {
    const notification = await Notification.create({ user, title, message, link });
    require('./realtime').publish(user, notification);
  } catch (error) {
    console.error('Notification delivery failed:', error.message);
  }
}
function publicProduct(product) {
  const result = product.toObject ? product.toObject() : { ...product };
  delete result.cost;
  delete result.stockMovements;
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
  const localMonth = (value) =>
    new Date(new Date(value).getTime() + 21600000).toISOString().slice(0, 7);
  const localNow = new Date(now.getTime() + 21600000);
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth() - 5 + index, 1),
    );
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
    if (!['delivered', 'returned'].includes(fulfillment.status)) continue;
    delivered++;
    const delivery = fulfillment.events.find((event) => event.status === 'delivered');
    const month = months.find((m) => m.key === localMonth(delivery?.at || order.updatedAt));
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
  for (const order of orders)
    for (const entry of order.returns || []) {
      if (String(entry.business) !== business.id || entry.status !== 'received' || !entry.restock)
        continue;
      const returnedCost = order.items
        .filter((i) => String(i.business) === business.id)
        .reduce((sum, i) => sum + i.cost * i.quantity, 0);
      cost -= returnedCost;
      const month = months.find((m) => m.key === localMonth(entry.receivedAt));
      if (month) month.cost -= returnedCost;
    }
  const grossRevenue = money(revenue);
  let refunds = 0;
  for (const order of orders)
    for (const refund of order.refunds || []) {
      if (String(refund.business) !== business.id || refund.status !== 'completed') continue;
      refunds += refund.amount;
      revenue -= refund.amount;
      const month = months.find((m) => m.key === localMonth(refund.completedAt));
      if (month) month.revenue -= refund.amount;
    }
  const totalExpenses = money(
    expenses
      .filter((e) => e.category !== 'product_purchase')
      .reduce((sum, expense) => sum + expense.amount, 0),
  );
  expenses
    .filter((e) => e.category !== 'product_purchase')
    .forEach((expense) => {
      const month = months.find((m) => m.key === localMonth(expense.date));
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
  const customers = new Map();
  let todaySales = 0,
    monthSales = 0,
    previousMonthSales = 0;
  const localDay = (value) =>
    new Date(new Date(value).getTime() + 21600000).toISOString().slice(0, 10);
  const today = localDay(now),
    monthKey = today.slice(0, 7),
    previousKey = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth() - 1, 1))
      .toISOString()
      .slice(0, 7);
  for (const order of orders) {
    const f = order.fulfillments.find((f) => String(f.business) === business.id);
    if (!['delivered', 'returned'].includes(f.status)) continue;
    customers.set(String(order.customer), (customers.get(String(order.customer)) || 0) + 1);
    const deliveredDay = localDay(
      f.events.find((e) => e.status === 'delivered')?.at || order.updatedAt,
    );
    const amount = order.items
      .filter((i) => String(i.business) === business.id)
      .reduce((sum, i) => sum + i.price * i.quantity - i.discount, 0);
    if (deliveredDay === today) todaySales += amount;
    if (deliveredDay.slice(0, 7) === monthKey) monthSales += amount;
    if (
      deliveredDay.slice(0, 7) === previousKey &&
      Number(deliveredDay.slice(8)) <= Number(today.slice(8))
    )
      previousMonthSales += amount;
    for (const refund of order.refunds || []) {
      if (String(refund.business) !== business.id || refund.status !== 'completed') continue;
      const paid = localDay(refund.completedAt);
      if (paid === today) todaySales -= refund.amount;
      if (paid.slice(0, 7) === monthKey) monthSales -= refund.amount;
      if (paid.slice(0, 7) === previousKey && Number(paid.slice(8)) <= Number(today.slice(8)))
        previousMonthSales -= refund.amount;
    }
  }
  const growth =
    previousMonthSales > 0
      ? money(((monthSales - previousMonthSales) / previousMonthSales) * 100)
      : null;
  const repeatCustomers = [...customers.values()].filter((count) => count > 1).length;
  const components = [
    {
      label: 'Sales growth',
      possible: 20,
      earned:
        growth === null
          ? monthSales > 0
            ? 10
            : 0
          : Math.round(Math.max(0, Math.min(20, 10 + growth / 10))),
      detail:
        'Net month-to-date sales versus the same days last month; a first sales month earns 10 points.',
    },
    {
      label: 'Order completion',
      possible: 20,
      earned: orders.length ? Math.round((20 * delivered) / orders.length) : 0,
      detail: 'Delivered orders divided by all store orders.',
    },
    {
      label: 'Inventory condition',
      possible: 15,
      earned: products.length
        ? Math.round((15 * (products.length - lowStock.length)) / products.length)
        : 0,
      detail: 'Active products above the low-stock threshold of five.',
    },
    {
      label: 'Customer retention',
      possible: 15,
      earned: customers.size ? Math.round((15 * repeatCustomers) / customers.size) : 0,
      detail: 'Customers with multiple delivered purchases divided by delivered customers.',
    },
    {
      label: 'Financial performance',
      possible: 15,
      earned:
        revenue - cost - totalExpenses > 0
          ? Math.round(15 * Math.max(0, 1 - totalExpenses / revenue))
          : 0,
      detail: 'Positive estimated profit with an expense-to-revenue ratio below one.',
    },
    {
      label: 'Customer ratings',
      possible: 15,
      earned: Math.round((15 * rating) / 5),
      detail: 'Verified purchase rating, weighted by review counts.',
    },
  ];
  return {
    todaySales: money(todaySales),
    pendingOrders: orders.filter((order) =>
      order.fulfillments.some(
        (f) =>
          String(f.business) === business.id &&
          !['delivered', 'cancelled', 'returned'].includes(f.status),
      ),
    ).length,
    customers: new Set(orders.map((o) => String(o.customer))).size,
    repeatCustomers,
    growth,
    grossProfit: money(revenue - cost),
    grossRevenue,
    refunds: money(refunds),
    revenue: money(revenue),
    cost: money(cost),
    expenses: totalExpenses,
    inventoryPurchases: money(
      expenses
        .filter((e) => e.category === 'product_purchase')
        .reduce((sum, e) => sum + e.amount, 0),
    ),
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

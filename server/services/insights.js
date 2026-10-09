const { Order, Product, Expense } = require('../models/commerce');
const { money, fail } = require('../utils/validation');
const day = (value) => new Date(new Date(value).getTime() + 21600000).toISOString().slice(0, 10);
function boundary(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail(400, 'Enter a valid date');
  const date = new Date(value + 'T00:00:00+06:00');
  if (!Number.isFinite(date.getTime()) || day(date) !== value) fail(400, 'Enter a valid date');
  return date;
}
async function insights(business, query = {}) {
  const now = new Date(),
    today = day(now),
    from = query.from ? boundary(query.from) : new Date(boundary(today).getTime() - 29 * 86400000),
    to = query.to
      ? new Date(boundary(query.to).getTime() + 86400000)
      : new Date(boundary(today).getTime() + 86400000);
  if (from >= to || to - from > 366 * 86400000) fail(400, 'Select a date range up to one year');
  const [orders, products, expenses] = await Promise.all([
    Order.find({ 'fulfillments.business': business._id }).lean(),
    Product.find({ business: business._id }).lean(),
    Expense.find({ business: business._id }).lean(),
  ]);
  const series = new Map(),
    sales = new Map(),
    lastSale = new Map(),
    buyers = new Map(),
    expenseTypes = new Map();
  for (let date = new Date(from); date < to; date = new Date(date.getTime() + 86400000))
    series.set(day(date), {
      date: day(date),
      revenue: 0,
      cost: 0,
      expenses: 0,
      refunds: 0,
      orders: 0,
      profit: 0,
    });
  let previousRevenue = 0,
    currentRevenue = 0,
    todayRevenue = 0,
    todayCost = 0,
    todayExpenses = 0,
    todayOrders = 0;
  const thisMonth = today.slice(0, 7),
    priorMonthDate = new Date(
      Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1),
    ),
    priorMonth = day(priorMonthDate).slice(0, 7);
  for (const order of orders) {
    const f = order.fulfillments.find((f) => String(f.business) === business.id),
      items = order.items.filter((i) => String(i.business) === business.id);
    if (day(order.createdAt) === today) todayOrders++;
    if (!['delivered', 'returned'].includes(f.status)) continue;
    const deliveredAt = f.events.find((e) => e.status === 'delivered')?.at || order.updatedAt,
      key = day(deliveredAt),
      bucket = series.get(key),
      value = items.reduce((s, i) => s + i.price * i.quantity - i.discount, 0),
      cost = items.reduce((s, i) => s + i.cost * i.quantity, 0);
    if (key === today) {
      todayRevenue += value;
      todayCost += cost;
    }
    if (key.slice(0, 7) === thisMonth) currentRevenue += value;
    if (key.slice(0, 7) === priorMonth && Number(key.slice(8)) <= Number(today.slice(8)))
      previousRevenue += value;
    if (bucket) {
      bucket.revenue += value;
      bucket.cost += cost;
      bucket.orders++;
      buyers.set(String(order.customer), (buyers.get(String(order.customer)) || 0) + 1);
    }
    for (const item of items) {
      const productKey = String(item.product);
      lastSale.set(
        productKey,
        new Date(Math.max(new Date(lastSale.get(productKey) || 0), new Date(deliveredAt))),
      );
      if (bucket) {
        const record = sales.get(productKey) || {
          product: productKey,
          name: item.name,
          quantity: 0,
          revenue: 0,
        };
        record.quantity += item.quantity;
        record.revenue += item.price * item.quantity - item.discount;
        sales.set(productKey, record);
      }
    }
    for (const entry of order.returns || []) {
      if (String(entry.business) !== business.id || entry.status !== 'received' || !entry.restock)
        continue;
      const returnDay = day(entry.receivedAt),
        returnBucket = series.get(returnDay);
      if (returnBucket) returnBucket.cost -= cost;
      if (returnDay === today) todayCost -= cost;
    }
    for (const r of order.refunds || []) {
      if (String(r.business) !== business.id || r.status !== 'completed') continue;
      const refundDay = day(r.completedAt),
        refundBucket = series.get(refundDay);
      if (refundBucket) {
        refundBucket.revenue -= r.amount;
        refundBucket.refunds += r.amount;
      }
      if (refundDay === today) todayRevenue -= r.amount;
      if (refundDay.slice(0, 7) === thisMonth) currentRevenue -= r.amount;
      if (
        refundDay.slice(0, 7) === priorMonth &&
        Number(refundDay.slice(8)) <= Number(today.slice(8))
      )
        previousRevenue -= r.amount;
    }
  }
  for (const expense of expenses) {
    const key = day(expense.date),
      bucket = series.get(key);
    if (key === today && expense.category !== 'product_purchase') todayExpenses += expense.amount;
    if (bucket) {
      if (expense.category !== 'product_purchase') bucket.expenses += expense.amount;
      expenseTypes.set(
        expense.category,
        (expenseTypes.get(expense.category) || 0) + expense.amount,
      );
    }
  }
  const daily = [...series.values()].map((row) => ({
    ...row,
    revenue: money(row.revenue),
    cost: money(row.cost),
    expenses: money(row.expenses),
    refunds: money(row.refunds),
    profit: money(row.revenue - row.cost - row.expenses),
  }));
  const weekly = new Map();
  for (const row of daily) {
    const date = new Date(row.date + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const key = date.toISOString().slice(0, 10),
      bucket = weekly.get(key) || { date: key, revenue: 0, expenses: 0, profit: 0, orders: 0 };
    for (const field of ['revenue', 'expenses', 'profit', 'orders']) bucket[field] += row[field];
    weekly.set(key, bucket);
  }
  const stock = (p) => (p.variants.length ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock);
  const slowMoving = products
    .filter((p) => p.active && stock(p) > 0)
    .map((p) => ({
      product: String(p._id),
      name: p.name,
      stock: stock(p),
      lastSale: lastSale.get(String(p._id)) || null,
      days: Math.floor((now - new Date(lastSale.get(String(p._id)) || p.createdAt)) / 86400000),
    }))
    .filter((p) => p.days >= 30)
    .sort((a, b) => b.days - a.days);
  const topProducts = [...sales.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10)
    .map((row) => ({ ...row, revenue: money(row.revenue) }));
  const growth =
    previousRevenue > 0
      ? money(((currentRevenue - previousRevenue) / previousRevenue) * 100)
      : null;
  const messages = [];
  const lowStock = products.filter((p) => p.active && stock(p) <= 5).length;
  if (lowStock) messages.push(lowStock + ' products are low on stock; review replenishment.');
  if (growth !== null)
    messages.push(
      'Month-to-date net sales ' +
        (growth >= 0 ? 'increased' : 'decreased') +
        ' by ' +
        Math.abs(growth) +
        '% versus the same days last month.',
    );
  if (topProducts.length)
    messages.push(topProducts[0].name + ' is the best-selling product in this date range.');
  if (slowMoving.length)
    messages.push(
      slowMoving.length + ' stocked products have no delivered sales for 30 days or more.',
    );
  const total = daily.reduce(
    (s, r) => {
      for (const field of ['revenue', 'cost', 'expenses', 'refunds', 'profit', 'orders'])
        s[field] += r[field];
      return s;
    },
    { revenue: 0, cost: 0, expenses: 0, refunds: 0, profit: 0, orders: 0 },
  );
  return {
    range: { from: day(from), to: day(new Date(to - 86400000)), timezone: 'Asia/Dhaka' },
    today: {
      revenue: money(todayRevenue),
      orders: todayOrders,
      profit: money(todayRevenue - todayCost - todayExpenses),
    },
    totals: Object.fromEntries(Object.entries(total).map(([k, v]) => [k, money(v)])),
    daily,
    weekly: [...weekly.values()],
    topProducts,
    slowMoving,
    expenseBreakdown: [...expenseTypes].map(([category, amount]) => ({
      category,
      amount: money(amount),
    })),
    customers: {
      total: buyers.size,
      repeat: [...buyers.values()].filter((count) => count > 1).length,
    },
    growth,
    insights: messages.length
      ? messages
      : ['Add products, orders and expenses to build meaningful business insights.'],
    recognition:
      'System-recorded estimated operating profit. Delivered sales less discounts and paid refunds, incurred product costs and recorded expenses.',
  };
}
module.exports = { insights };

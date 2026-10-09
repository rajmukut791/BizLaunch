const router = require('express').Router(),
  { protect, roles } = require('../middleware/auth'),
  { fail, id, number } = require('../utils/validation'),
  { Product } = require('../models/commerce');
const Cart = require('../models/Cart');
router.use('/cart', protect, roles('customer'));
router.get('/cart', async (req, res) => {
  const cart = await Cart.findOne({ customer: req.user.id });
  const items = [];
  for (const entry of cart?.items || []) {
    const product = await Product.findById(entry.product).populate('business', 'name');
    if (!product) continue;
    const variant = entry.variantId ? product.variants.id(entry.variantId) : null;
    items.push({
      key: product.id + ':' + entry.variantId,
      product: product.id,
      variantId: entry.variantId,
      variantName: variant?.name || '',
      name: product.name,
      image: product.images[0] || '',
      price: variant?.price ?? product.price,
      stock: variant?.stock ?? product.stock,
      quantity: entry.quantity,
      business: String(product.business._id),
      businessName: product.business.name,
      unavailable: !product.active || (!!entry.variantId && !variant),
    });
  }
  res.json({ success: true, items });
});
router.put('/cart', async (req, res) => {
  if (!Array.isArray(req.body?.items) || req.body.items.length > 50)
    fail(400, 'Use at most 50 cart items');
  const keys = new Set(),
    items = req.body.items.map((entry) => {
      const product = id(entry.product),
        variantId = entry.variantId ? id(entry.variantId) : '',
        quantity = number(entry.quantity, 'Quantity', 1, 100, true),
        key = product + ':' + variantId;
      if (keys.has(key)) fail(400, 'Combine duplicate cart items');
      keys.add(key);
      return { product, variantId, quantity };
    });
  await Cart.updateOne(
    { customer: req.user.id },
    { $set: { items } },
    { upsert: true, runValidators: true },
  );
  res.json({ success: true });
});
module.exports = { router, Cart };

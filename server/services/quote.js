const { businessIsPublic } = require('./commerce');
const { Product, Business, Coupon } = require('../models/commerce');
const { fail, text, number, id, money } = require('../utils/validation');
async function quote(body, session = null) {
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50)
    fail(400, 'Cart must contain 1–50 items');
  const lines = [],
    keys = new Set();
  for (const input of body.items) {
    const productId = id(input.product),
      quantity = number(input.quantity, 'Quantity', 1, 100, true);
    const product = await Product.findOne({ _id: productId, active: true }).session(session);
    if (!product) fail(409, 'A product in your cart is no longer available');
    if (!(await businessIsPublic(await Business.findById(product.business).session(session))))
      fail(409, 'A store in your cart is not accepting orders');
    let variant;
    if (product.variants.length) {
      variant = product.variants.id(id(input.variantId));
      if (!variant) fail(400, 'Choose a valid product variant');
    } else if (input.variantId) fail(400, 'This product has no variants');
    if ((variant?.stock ?? product.stock) < quantity)
      fail(409, product.name + ' has insufficient stock');
    const key = productId + ':' + (variant?.id || '');
    if (keys.has(key)) fail(400, 'Combine duplicate cart items');
    keys.add(key);
    lines.push({
      product: product._id,
      business: product.business,
      variantId: variant?.id || '',
      variantName: variant?.name || '',
      name: product.name,
      image: product.images[0] || '',
      price: variant?.price ?? product.price,
      cost: variant?.cost ?? product.cost,
      quantity,
      discount: 0,
      version: product.__v,
    });
  }
  let coupon;
  if (body.couponCode) {
    coupon = await Coupon.findOne({
      code: text(body.couponCode, 'Coupon code', 3, 30).toUpperCase(),
      active: true,
      expiresAt: { $gt: new Date() },
      $expr: { $lt: ['$used', '$limit'] },
    }).session(session);
    if (!coupon) fail(400, 'Coupon is expired, unavailable or fully used');
    const eligible = lines.filter((line) => String(line.business) === String(coupon.business));
    const eligibleTotal = money(
      eligible.reduce((sum, line) => sum + line.price * line.quantity, 0),
    );
    if (!eligible.length || eligibleTotal < coupon.minimum)
      fail(400, 'This coupon minimum is not met for its store');
    eligible.forEach((line) => {
      line.discount = money((line.price * line.quantity * coupon.percent) / 100);
    });
  }
  const subtotal = money(lines.reduce((sum, line) => sum + line.price * line.quantity, 0)),
    discount = money(lines.reduce((sum, line) => sum + line.discount, 0));
  return { lines, subtotal, discount, total: money(subtotal - discount), coupon };
}
module.exports = quote;

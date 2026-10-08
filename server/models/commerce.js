const mongoose = require('mongoose');
const { Schema } = mongoose;
const ref = (model) => ({ type: Schema.Types.ObjectId, ref: model, required: true });
const amount = { type: Number, min: 0, required: true };
const options = { timestamps: true };
const businessSchema = new Schema(
  {
    owner: { ...ref('User'), unique: true },
    name: { type: String, required: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true },
    description: { type: String, maxlength: 2000, default: '' },
    phone: String,
    address: String,
    verification: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    verificationNote: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  options,
);
const categorySchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true },
    description: String,
  },
  options,
);
const variantSchema = new Schema(
  {
    name: { type: String, required: true },
    sku: { type: String, required: true },
    price: amount,
    cost: { type: Number, min: 0, default: 0 },
    stock: { type: Number, min: 0, required: true },
  },
  { _id: true },
);
const productSchema = new Schema(
  {
    business: ref('Business'),
    category: ref('Category'),
    name: { type: String, required: true, maxlength: 120 },
    description: { type: String, maxlength: 4000, default: '' },
    price: amount,
    cost: { type: Number, min: 0, default: 0 },
    stock: { type: Number, min: 0, default: 0 },
    images: [String],
    variants: [variantSchema],
    active: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
  },
  options,
);
productSchema.index({ business: 1, active: 1, category: 1 });
const lineSchema = new Schema(
  {
    product: ref('Product'),
    business: ref('Business'),
    variantId: String,
    variantName: String,
    name: String,
    image: String,
    price: amount,
    cost: amount,
    quantity: { type: Number, min: 1, required: true },
    discount: { type: Number, default: 0 },
  },
  { _id: false },
);
const eventSchema = new Schema(
  { status: String, at: { type: Date, default: Date.now } },
  { _id: false },
);
const fulfillmentSchema = new Schema(
  {
    business: ref('Business'),
    status: {
      type: String,
      enum: ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'placed',
    },
    trackingNumber: { type: String, default: '' },
    events: [eventSchema],
  },
  { _id: false },
);
const orderSchema = new Schema(
  {
    customer: ref('User'),
    checkoutKey: { type: String, required: true },
    number: { type: String, required: true, unique: true },
    items: [lineSchema],
    shipping: { name: String, phone: String, address: String, city: String, postalCode: String },
    paymentMethod: { type: String, enum: ['cod'], default: 'cod' },
    subtotal: amount,
    discount: amount,
    total: amount,
    coupon: { type: Schema.Types.ObjectId, ref: 'Coupon' },
    couponCode: String,
    fulfillments: [fulfillmentSchema],
  },
  options,
);
orderSchema.index({ customer: 1, checkoutKey: 1 }, { unique: true });
const couponSchema = new Schema(
  {
    business: ref('Business'),
    code: { type: String, required: true, uppercase: true },
    percent: { type: Number, min: 1, max: 80 },
    minimum: { type: Number, min: 0, default: 0 },
    expiresAt: { type: Date, required: true },
    limit: { type: Number, min: 1, default: 100 },
    used: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  options,
);
couponSchema.index({ code: 1 }, { unique: true });
const expenseSchema = new Schema(
  {
    business: ref('Business'),
    title: { type: String, required: true },
    category: String,
    amount,
    date: { type: Date, required: true },
    note: String,
  },
  options,
);
const reviewSchema = new Schema(
  {
    customer: ref('User'),
    product: ref('Product'),
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, maxlength: 1000 },
  },
  options,
);
reviewSchema.index({ customer: 1, product: 1 }, { unique: true });
const notificationSchema = new Schema(
  {
    user: ref('User'),
    title: String,
    message: String,
    link: String,
    read: { type: Boolean, default: false },
  },
  options,
);
const reportSchema = new Schema(
  {
    reporter: ref('User'),
    business: ref('Business'),
    reason: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open' },
    resolution: String,
  },
  options,
);
const checkoutSchema = new Schema({ customer: ref('User'), key: String }, options);
checkoutSchema.index({ customer: 1, key: 1 }, { unique: true });
const models = {
  Business: businessSchema,
  Category: categorySchema,
  Product: productSchema,
  Order: orderSchema,
  Coupon: couponSchema,
  Expense: expenseSchema,
  Review: reviewSchema,
  Notification: notificationSchema,
  Report: reportSchema,
  CheckoutLock: checkoutSchema,
};
module.exports = Object.fromEntries(
  Object.entries(models).map(([name, schema]) => [name, mongoose.model(name, schema)]),
);

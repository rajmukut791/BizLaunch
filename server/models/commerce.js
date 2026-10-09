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
    logo: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    category: { type: String, default: '' },
    type: { type: String, default: 'retail' },
    theme: { type: String, enum: ['sage', 'midnight', 'coral'], default: 'sage' },
    email: { type: String, default: '' },
    socialLinks: { website: String, facebook: String, instagram: String },
    currency: { type: String, enum: ['BDT'], default: 'BDT' },
    deliveryOptions: { type: String, default: 'Standard delivery' },
    returnPolicy: { type: String, default: '' },
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
    size: { type: String, default: '' },
    color: { type: String, default: '' },
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
    subcategory: { type: String, default: '' },
    sku: { type: String, default: '' },
    brand: { type: String, default: '' },
    size: { type: String, default: '' },
    color: { type: String, default: '' },
    weight: { type: Number, min: 0, default: 0 },
    listingStatus: { type: String, enum: ['draft', 'active', 'archived'], default: 'active' },
    regularPrice: { type: Number, min: 0, default: 0 },
    stockMovements: [
      new Schema(
        {
          type: { type: String, enum: ['PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT'] },
          variantId: String,
          before: Number,
          after: Number,
          delta: Number,
          reference: String,
          note: String,
          actor: { type: Schema.Types.ObjectId, ref: 'User' },
          at: { type: Date, default: Date.now },
        },
        { _id: true },
      ),
    ],
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
productSchema.index(
  { name: 'text', brand: 'text', sku: 'text', description: 'text' },
  { weights: { name: 10, brand: 5, sku: 5, description: 1 } },
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
      enum: ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
      default: 'placed',
    },
    trackingNumber: { type: String, default: '' },
    paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
    paidAt: Date,
    collectedAmount: { type: Number, min: 0, default: 0 },
    paymentReference: { type: String, default: '' },
    events: [eventSchema],
  },
  { _id: false },
);
const refundSchema = new Schema({
  business: ref('Business'),
  amount,
  reason: { type: String, required: true, maxlength: 1000 },
  status: {
    type: String,
    enum: ['requested', 'approved', 'rejected', 'completed'],
    default: 'requested',
  },
  version: { type: Number, default: 0, min: 0 },
  requestedAt: Date,
  updatedAt: Date,
  completedAt: Date,
  payoutMethod: { type: String, enum: ['cash', 'bank_transfer', 'mobile_banking'] },
  payoutReference: { type: String, maxlength: 120 },
  events: [
    new Schema(
      { status: String, note: { type: String, maxlength: 1000 }, actor: ref('User'), at: Date },
      { _id: false },
    ),
  ],
});
const orderSchema = new Schema(
  {
    customer: ref('User'),
    checkoutKey: { type: String, required: true },
    number: { type: String, required: true, unique: true },
    items: [lineSchema],
    shipping: {
      name: String,
      phone: String,
      address: String,
      city: String,
      postalCode: String,
      division: String,
      district: String,
      area: String,
      deliveryMethod: String,
    },
    paymentMethod: { type: String, enum: ['cod'], default: 'cod' },
    subtotal: amount,
    discount: amount,
    total: amount,
    coupon: { type: Schema.Types.ObjectId, ref: 'Coupon' },
    couponCode: String,
    fulfillments: [fulfillmentSchema],
    refunds: [refundSchema],
    returns: [
      new Schema({
        business: ref('Business'),
        reason: String,
        status: {
          type: String,
          enum: ['requested', 'approved', 'rejected', 'received'],
          default: 'requested',
        },
        version: { type: Number, default: 0 },
        requestedAt: Date,
        updatedAt: Date,
        receivedAt: Date,
        restock: { type: Boolean, default: false },
        events: [
          new Schema(
            { status: String, note: String, actor: ref('User'), at: Date },
            { _id: false },
          ),
        ],
      }),
    ],
  },
  options,
);
orderSchema.index({ customer: 1, checkoutKey: 1 }, { unique: true });
orderSchema.index({ createdAt: -1, _id: -1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ 'fulfillments.business': 1, createdAt: -1 });
const couponSchema = new Schema(
  {
    business: ref('Business'),
    code: { type: String, required: true, uppercase: true },
    percent: { type: Number, min: 1, max: 80 },
    discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    discountValue: { type: Number, min: 0 },
    startsAt: { type: Date, default: () => new Date(0) },
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
    hidden: { type: Boolean, default: false },
    moderationNote: String,
    reply: String,
    repliedAt: Date,
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
    targetType: { type: String, enum: ['business', 'product', 'review'], default: 'business' },
    targetId: { type: Schema.Types.ObjectId },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open' },
    resolution: String,
  },
  options,
);
const checkoutSchema = new Schema({ customer: ref('User'), key: String }, options);
checkoutSchema.index({ customer: 1, key: 1 }, { unique: true });
const models = {
  Wishlist: new Schema({ customer: ref('User'), product: ref('Product') }, options),
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
models.Wishlist.index({ customer: 1, product: 1 }, { unique: true });
module.exports = Object.fromEntries(
  Object.entries(models).map(([name, schema]) => [name, mongoose.model(name, schema)]),
);

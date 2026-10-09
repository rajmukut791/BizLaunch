const mongoose = require('mongoose'),
  { Schema } = mongoose;
const schema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [
      {
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        variantId: { type: String, default: '' },
        quantity: { type: Number, min: 1, max: 100 },
      },
    ],
  },
  { timestamps: true },
);
module.exports = mongoose.model('Cart', schema);

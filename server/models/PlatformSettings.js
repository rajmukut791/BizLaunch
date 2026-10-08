const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    _id: { type: String, default: 'platform' },
    enabled: { type: Boolean, default: false },
    title: { type: String, default: 'A little care. A better BizLaunch.', maxlength: 90 },
    message: {
      type: String,
      default:
        'We are making a few thoughtful improvements. Your account and orders are safe. Please check back shortly.',
      maxlength: 600,
    },
    endsAt: { type: Date, default: null },
    version: { type: Number, default: 0 },
    history: [
      {
        enabled: Boolean,
        title: String,
        message: String,
        endsAt: Date,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        changedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);
module.exports = mongoose.model('PlatformSettings', schema);

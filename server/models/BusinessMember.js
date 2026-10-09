const mongoose = require('mongoose'),
  { Schema } = mongoose;
const schema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    email: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    job: { type: String, enum: ['manager', 'sales', 'inventory'], required: true },
    permissions: [String],
    status: { type: String, enum: ['invited', 'active', 'revoked'], default: 'invited' },
    tokenHash: { type: String, select: false },
    expiresAt: Date,
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    joinedAt: Date,
  },
  { timestamps: true },
);
schema.index({ business: 1, email: 1 }, { unique: true });
schema.index(
  { user: 1 },
  { unique: true, partialFilterExpression: { status: 'active', user: { $type: 'objectId' } } },
);
module.exports = mongoose.model('BusinessMember', schema);

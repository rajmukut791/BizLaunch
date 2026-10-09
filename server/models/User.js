const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },

    phone: {
      type: String,
      trim: true,
      default: '',
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },

    role: {
      type: String,
      enum: ['customer', 'seller', 'admin', 'staff'],
      default: 'customer',
    },

    verificationTokenHash: { type: String, select: false, index: true, unique: true, sparse: true },
    verificationExpiresAt: { type: Date, select: false },
    verificationSentAt: { type: Date, select: false },
    resetTokenHash: { type: String, select: false, index: true, unique: true, sparse: true },
    resetExpiresAt: { type: Date, select: false },
    resetSentAt: { type: Date, select: false },
    tokenVersion: { type: Number, default: 0 },
    avatar: {
      type: String,
      default: '',
    },

    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Hash password before saving.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare login password with hashed password.
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;

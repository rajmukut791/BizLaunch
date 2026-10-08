const { randomBytes, createHash } = require('node:crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const mail = require('../services/mail');
const { email, password, fail } = require('../utils/validation');
const digest = (token) => createHash('sha256').update(token).digest('hex');
function tokenHash(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    fail(400, 'This link is invalid or expired');
  return digest(value);
}
async function issue(user, purpose) {
  if (!mail.available())
    fail(503, 'Email delivery is temporarily unavailable. Please try again later.');
  const token = randomBytes(32).toString('hex');
  const prefix = purpose === 'verification' ? 'verification' : 'reset';
  const tokenField = prefix + 'TokenHash',
    expiryField = prefix + 'ExpiresAt',
    sentField = prefix + 'SentAt';
  const updated = await User.findOneAndUpdate(
    {
      _id: user._id,
      $or: [
        { [sentField]: { $lt: new Date(Date.now() - 60000) } },
        { [sentField]: { $exists: false } },
      ],
    },
    {
      $set: {
        [tokenField]: digest(token),
        [expiryField]: new Date(Date.now() + (purpose === 'verification' ? 86400000 : 1800000)),
        [sentField]: new Date(),
      },
    },
  );
  if (!updated) return;
  try {
    await mail.sendLink(user, purpose, token);
  } catch {
    await User.updateOne(
      { _id: user._id, [tokenField]: digest(token) },
      { $unset: { [tokenField]: '', [expiryField]: '', [sentField]: '' } },
    );
    fail(503, 'Email delivery is temporarily unavailable. Please try again later.');
  }
}
exports.issue = issue;
exports.resend = async (req, res) => {
  const address = email(req.body?.email);
  if (!mail.available())
    fail(503, 'Email delivery is temporarily unavailable. Please try again later.');
  const user = await User.findOne({ email: address, emailVerified: false, status: 'active' });
  if (user) await issue(user, 'verification');
  res.json({
    success: true,
    message:
      'If your account needs verification, a link has been sent. Check your inbox and spam folder.',
  });
};
exports.verify = async (req, res) => {
  const user = await User.findOneAndUpdate(
    {
      verificationTokenHash: tokenHash(req.body?.token),
      verificationExpiresAt: { $gt: new Date() },
      emailVerified: false,
      status: 'active',
    },
    {
      $set: { emailVerified: true },
      $unset: { verificationTokenHash: '', verificationExpiresAt: '', verificationSentAt: '' },
      $inc: { tokenVersion: 1 },
    },
  );
  if (!user) fail(400, 'This link is invalid or expired');
  res.json({
    success: true,
    role: user.role,
    message: 'Your email is verified. You can now sign in.',
  });
};
exports.forgot = async (req, res) => {
  const address = email(req.body?.email);
  if (!mail.available())
    fail(503, 'Email delivery is temporarily unavailable. Please try again later.');
  const user = await User.findOne({ email: address, emailVerified: true, status: 'active' });
  if (user) await issue(user, 'reset');
  res.json({
    success: true,
    message: 'If an eligible account exists, a password reset link has been sent.',
  });
};
exports.reset = async (req, res) => {
  const hash = tokenHash(req.body?.token);
  const secret = password(req.body?.password);
  const encoded = await bcrypt.hash(secret, 12);
  const user = await User.findOneAndUpdate(
    {
      resetTokenHash: hash,
      resetExpiresAt: { $gt: new Date() },
      emailVerified: true,
      status: 'active',
    },
    {
      $set: { password: encoded },
      $inc: { tokenVersion: 1 },
      $unset: { resetTokenHash: '', resetExpiresAt: '', resetSentAt: '' },
    },
  );
  if (!user) fail(400, 'This link is invalid or expired');
  res.clearCookie('bizlaunch_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  res.json({ success: true, message: 'Password updated. Sign in with your new password.' });
};

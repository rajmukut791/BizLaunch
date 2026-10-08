const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { fail, text, email, password } = require('../utils/validation');
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: 7 * 86400000,
});
const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  avatar: user.avatar,
  status: user.status,
  emailVerified: user.emailVerified,
});
function session(res, user) {
  const token = jwt.sign({ userId: user.id, version: user.tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: '7d',
    algorithm: 'HS256',
  });
  res.cookie('bizlaunch_session', token, cookieOptions());
}
exports.register = async (req, res) => {
  const data = req.body || {};
  const name = text(data.name, 'Name', 2, 60);
  const normalizedEmail = email(data.email);
  const secret = password(data.password);
  const role = data.role || 'customer';
  if (!['customer', 'seller'].includes(role)) fail(400, 'Choose a customer or seller account');
  const phone = text(data.phone || '', 'Phone', 0, 30);
  if (await User.exists({ email: normalizedEmail }))
    fail(409, 'An account already exists with this email');
  if (!require('../services/mail').available())
    fail(503, 'Email delivery is temporarily unavailable. Please try again later.');
  const user = await User.create({ name, email: normalizedEmail, password: secret, phone, role });
  await require('./emailAuthController').issue(user, 'verification');
  res.status(201).json({ success: true, verificationRequired: true, email: user.email });
};
exports.login = async (req, res) => {
  const normalizedEmail = email(req.body?.email);
  const secret = text(req.body?.password, 'Password', 1, 72);
  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user || !(await user.comparePassword(secret))) fail(401, 'Email or password is incorrect');
  if (user.status !== 'active') fail(403, 'Your account is suspended');
  if (!user.emailVerified) fail(403, 'Verify your email before signing in');
  user.lastLogin = new Date();
  await user.save();
  session(res, user);
  res.json({ success: true, user: publicUser(user) });
};
exports.me = (req, res) => res.json({ success: true, user: publicUser(req.user) });
exports.logout = async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 } });
  const { maxAge, ...options } = cookieOptions();
  res.clearCookie('bizlaunch_session', options);
  res.json({ success: true });
};

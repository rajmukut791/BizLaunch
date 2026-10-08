const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { fail } = require('../utils/validation');
async function protect(req, res, next) {
  const token = req.cookies?.bizlaunch_session;
  if (!token) fail(401, 'Please sign in to continue');
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    fail(401, 'Your session expired. Please sign in again');
  }
  const user = await User.findById(payload.userId);
  if (!user || user.tokenVersion !== payload.version) fail(401, 'Please sign in again');
  if (user.status !== 'active') fail(403, 'Your account is suspended');
  if (!user.emailVerified) fail(403, 'Verify your email before signing in');
  req.user = user;
  next();
}
const roles =
  (...allowed) =>
  (req, res, next) => {
    if (!allowed.includes(req.user.role)) fail(403, 'You do not have access to this action');
    next();
  };
module.exports = { protect, roles };

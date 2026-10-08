const { settings, publicStatus } = require('../services/maintenance');
const { protect } = require('./auth');
module.exports = async (req, res, next) => {
  const current = await settings();
  if (!current.enabled) return next();
  if (req.cookies?.bizlaunch_session) {
    try {
      await protect(req, res, () => {});
      if (req.user?.role === 'admin') return next();
    } catch {
      /* Maintenance stays closed for unauthenticated requests. */
    }
  }
  const retry = current.endsAt
    ? Math.max(1, Math.ceil((new Date(current.endsAt) - Date.now()) / 1000))
    : 300;
  res.set('Retry-After', String(retry)).set('Cache-Control', 'no-store');
  res
    .status(503)
    .json({
      success: false,
      code: 'MAINTENANCE',
      message: current.message,
      maintenance: publicStatus(current),
    });
};

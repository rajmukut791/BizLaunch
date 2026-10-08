const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const limiter = rateLimit({
  windowMs: 15 * 60000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes' },
});
router.post('/register', limiter, controller.register);
router.post('/login', limiter, controller.login);
router.get('/me', protect, controller.me);
router.post('/logout', protect, controller.logout);
const emailAuth = require('../controllers/emailAuthController');
router.post('/verify-email', limiter, emailAuth.verify);
router.post('/resend-verification', limiter, emailAuth.resend);
router.post('/forgot-password', limiter, emailAuth.forgot);
router.post('/reset-password', limiter, emailAuth.reset);
if (
  process.env.NODE_ENV === 'test' &&
  /^bizlaunch_e2e_[a-f0-9]{32}$/.test(process.env.BIZLAUNCH_E2E_DB || '')
) {
  router.get('/test-delivery', (req, res) => {
    const mail = require('../services/mail');
    if (!mail.isTest()) return res.sendStatus(404);
    res.json(mail.testDelivery(req.query.email) || {});
  });
}
module.exports = router;

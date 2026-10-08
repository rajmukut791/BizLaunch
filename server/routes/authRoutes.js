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
module.exports = router;

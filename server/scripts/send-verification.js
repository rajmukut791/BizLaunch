require('../config/env')();
const mongoose = require('mongoose');
const connect = require('../config/db');
const User = require('../models/User');
const mail = require('../services/mail');
const { issue } = require('../controllers/emailAuthController');
(async () => {
  if (!mail.available())
    throw new Error('Configure SMTP_USER, SMTP_PASSWORD and MAIL_FROM in server/.env first');
  await connect();
  for (const email of ['rajmukut791@gmail.com', 'rajmukut1628@gmail.com', 'rajmukut66@gmail.com']) {
    const user = await User.findOne({ email, status: 'active' });
    if (!user) throw new Error('Account is missing: ' + email);
    if (user.emailVerified) {
      console.log(email + ': already verified');
      continue;
    }
    await issue(user, 'verification');
    console.log(email + ': verification requested; check inbox and spam folder');
  }
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

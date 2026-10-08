require('../config/env')();
const mongoose = require('mongoose');
const connect = require('../config/db');
const User = require('../models/User');
(async () => {
  if (!process.env.BIZLAUNCH_ACCOUNT_PASSWORD)
    throw new Error('Set BIZLAUNCH_ACCOUNT_PASSWORD for this invocation');
  await connect();
  for (const [email, role] of [
    ['rajmukut791@gmail.com', 'admin'],
    ['rajmukut1628@gmail.com', 'seller'],
    ['rajmukut66@gmail.com', 'customer'],
  ]) {
    let user = await User.findOne({ email }).select('+password');
    if (user && user.role !== role) throw new Error('Existing account role mismatch: ' + email);
    if (!user) user = new User({ email, role, name: 'Rajmukut ' + role });
    user.password = process.env.BIZLAUNCH_ACCOUNT_PASSWORD;
    user.tokenVersion += 1;
    await user.save();
    console.log(
      role + ': ' + email + ' — ' + (user.emailVerified ? 'verified' : 'verification required'),
    );
  }
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

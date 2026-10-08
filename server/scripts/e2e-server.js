require('../config/env');
const mongoose = require('mongoose');
if (!/^bizlaunch_e2e_[a-f0-9]{32}$/.test(process.env.BIZLAUNCH_E2E_DB || ''))
  throw new Error('A unique isolated E2E database is required');
const uri = new URL(process.env.MONGO_URI);
uri.pathname = '/' + process.env.BIZLAUNCH_E2E_DB;
process.env.MONGO_URI = uri.toString();
process.env.DEMO_PASSWORD = 'BizLaunch123!';
process.env.NODE_ENV = 'test';
(async () => {
  await require('./seed')();
  await mongoose.disconnect();
  require('../server');
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

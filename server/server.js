const validateEnv = require('./config/env');
const mongoose = require('mongoose');
const app = require('./app');
const connectDB = require('./config/db');
let server;
async function start() {
  const { port } = validateEnv();
  await connectDB();
  server = app.listen(port, () => console.log('BizLaunch API: http://localhost:' + port));
  server.on('error', async (error) => {
    console.error('Server failed: ' + error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  clearTimeout(timeout);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
start().catch(async (error) => {
  console.error('Startup failed: ' + error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const mongoose = require('mongoose');
const root = path.resolve(__dirname, '../../artifacts');
const dbPath = path.join(root, 'mongo-test-' + randomUUID());
const port = Number(process.env.TEST_MONGO_PORT || 27018);
const uri = 'mongodb://127.0.0.1:' + port + '/bizlaunch?directConnection=true';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let mongo;
async function run() {
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('Invalid TEST_MONGO_PORT');
  fs.mkdirSync(dbPath, { recursive: true });
  mongo = spawn(
    process.env.MONGOD_BINARY || 'mongod',
    [
      '--dbpath',
      dbPath,
      '--replSet',
      'bizlaunch-test',
      '--port',
      String(port),
      '--bind_ip',
      '127.0.0.1',
      '--logpath',
      path.join(dbPath, 'mongo.log'),
    ],
    { stdio: 'ignore', windowsHide: true },
  );
  let startupError;
  mongo.on('error', (error) => {
    startupError = error;
  });
  for (let attempt = 0; attempt < 60; attempt++) {
    if (startupError) throw startupError;
    if (mongo.exitCode !== null)
      throw new Error('Isolated mongod exited; check the test port or MONGOD_BINARY');
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 500 });
      break;
    } catch {
      await delay(250);
    }
  }
  if (mongoose.connection.readyState !== 1) throw new Error('Isolated MongoDB did not start');
  const options = await mongoose.connection.db.admin().command({ getCmdLineOpts: 1 });
  if (path.resolve(options.parsed.storage.dbPath) !== path.resolve(dbPath))
    throw new Error('Refusing to initialize an existing MongoDB server');
  await mongoose.connection.db
    .admin()
    .command({
      replSetInitiate: { _id: 'bizlaunch-test', members: [{ _id: 0, host: '127.0.0.1:' + port }] },
    });
  let primary = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (hello.isWritablePrimary) {
      primary = true;
      break;
    }
    await delay(250);
  }
  if (!primary) throw new Error('Replica set did not elect a primary');
  await mongoose.disconnect();
  console.log('Running the API suite against an isolated MongoDB replica set');
  const child = spawn(
    process.execPath,
    ['--test', '--test-concurrency=1', 'tests/commerce.test.js'],
    {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, MONGO_URI: uri },
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', resolve);
  });
  process.exitCode = exitCode || 0;
}
run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    if (mongo && mongo.exitCode === null) {
      mongo.kill();
      await Promise.race([new Promise((resolve) => mongo.once('exit', resolve)), delay(5000)]);
    }
    // Only remove the unique temporary directory created by this test invocation.
    if (fs.existsSync(dbPath)) {
      const resolved = fs.realpathSync(dbPath),
        allowed = fs.realpathSync(root) + path.sep;
      if (!resolved.startsWith(allowed) || !path.basename(resolved).startsWith('mongo-test-'))
        throw new Error('Unsafe test cleanup path');
      fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  });

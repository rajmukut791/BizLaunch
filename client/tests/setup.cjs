const { spawn } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
async function waitFor(url, processRef) {
  for (let attempt = 0; attempt < 240; attempt++) {
    if (processRef.exitCode !== null) throw new Error('Test server exited before becoming ready');
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* Await startup. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Test server did not become ready');
}
module.exports = async () => {
  const api = spawn(process.execPath, ['server/scripts/e2e-server.js'], {
    cwd: root,
    env: { ...process.env, PORT: '5001', CLIENT_URL: 'http://localhost:5174' },
    stdio: 'ignore',
  });
  process.env.BIZLAUNCH_E2E_API_PID = String(api.pid);
  const vite = spawn(
    process.execPath,
    [path.join(root, 'client/node_modules/vite/bin/vite.js'), '--port', '5174'],
    {
      cwd: path.join(root, 'client'),
      env: { ...process.env, BIZLAUNCH_API_URL: 'http://localhost:5001' },
      stdio: 'ignore',
    },
  );
  process.env.BIZLAUNCH_E2E_VITE_PID = String(vite.pid);
  try {
    await Promise.all([
      waitFor('http://localhost:5001/api/ready', api),
      waitFor('http://localhost:5174', vite),
    ]);
  } catch (error) {
    api.kill();
    vite.kill();
    throw error;
  }
  api.unref();
  vite.unref();
};

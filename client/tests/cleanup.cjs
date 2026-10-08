module.exports = async () => {
  for (const key of ['BIZLAUNCH_E2E_VITE_PID', 'BIZLAUNCH_E2E_API_PID']) {
    const pid = Number(process.env[key]);
    if (Number.isInteger(pid) && pid > 0) {
      try {
        process.kill(pid);
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
  }
  const mongoose = require('../../server/node_modules/mongoose');
  require('../../server/config/env');
  const database = process.env.BIZLAUNCH_E2E_DB;
  if (!/^bizlaunch_e2e_[a-f0-9]{32}$/.test(database || ''))
    throw new Error('Refusing cleanup outside an isolated E2E database');
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: database,
      serverSelectionTimeoutMS: 5000,
    });
    if (mongoose.connection.name !== database) throw new Error('Database name mismatch');
    await mongoose.connection.dropDatabase();
  } finally {
    await mongoose.disconnect();
  }
};

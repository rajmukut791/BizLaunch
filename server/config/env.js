const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });

function validateEnv() {
  for (const key of ['MONGO_URI', 'JWT_SECRET', 'CLIENT_URL']) {
    if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
  }
  if (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-with-')) {
    throw new Error('JWT_SECRET must be a unique secret of at least 32 characters');
  }
  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be between 1 and 65535');
  const clientUrl = new URL(process.env.CLIENT_URL);
  if (!['http:', 'https:'].includes(clientUrl.protocol))
    throw new Error('CLIENT_URL must be an HTTP or HTTPS URL');
  return { port };
}

module.exports = validateEnv;

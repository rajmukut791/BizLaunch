const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('node:path');
const mongoose = require('mongoose');
const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
const allowedOrigins = new Set(
  [process.env.CLIENT_URL, ...(process.env.CLIENT_ORIGINS || '').split(',')]
    .filter(Boolean)
    .map((value) => new URL(value.trim()).origin),
);
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
    credentials: true,
  }),
);
app.use(cookieParser());
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if ((origin && !allowedOrigins.has(origin)) || req.get('sec-fetch-site') === 'cross-site') {
      return res.status(403).json({ success: false, message: 'Request origin is not allowed' });
    }
    if (
      req.path.startsWith('/api') &&
      !req.path.endsWith('/images') &&
      !req.is('application/json')
    ) {
      return res
        .status(415)
        .json({ success: false, message: 'Use application/json for API requests' });
    }
  }
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60000,
    limit: process.env.NODE_ENV === 'test' ? 10000 : 1000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Try again later' },
  }),
);
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    dotfiles: 'deny',
    immutable: true,
    maxAge: '1d',
  }),
);
app.use('/demo', express.static(path.join(__dirname, 'demo'), { immutable: true, maxAge: '1d' }));
app.get('/', (req, res) => res.json({ success: true, message: 'BizLaunch API is running' }));
app.get('/api/health', (req, res) =>
  res.json({
    success: true,
    status: 'OK',
    application: 'BizLaunch',
    timestamp: new Date().toISOString(),
  }),
);
app.get('/api/ready', (req, res) =>
  res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
    success: mongoose.connection.readyState === 1,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  }),
);
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api', require('./routes/platformRoutes'));
app.use('/api', require('./middleware/maintenance'));
app.use('/api', require('./routes/commerceRoutes'));
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 11000)
    return res
      .status(409)
      .json({ success: false, message: 'A record with these details already exists' });
  if (error.name === 'ValidationError' || error.name === 'CastError')
    return res.status(400).json({
      success: false,
      message:
        error.name === 'CastError' ? 'Invalid record ID' : Object.values(error.errors)[0].message,
    });
  if (error.name === 'MulterError')
    return res
      .status(400)
      .json({ success: false, message: 'Upload one image no larger than 5 MB' });
  if (error.name === 'VersionError')
    return res
      .status(409)
      .json({ success: false, message: 'Record changed. Reload and try again' });
  const status = error.status || error.statusCode || 500;
  if (status >= 500) console.error(error.message);
  res.status(status).json({
    success: false,
    message: status >= 500 ? 'Service temporarily unavailable' : error.message,
  });
});
module.exports = app;

const { Server } = require('socket.io'),
  jwt = require('jsonwebtoken'),
  User = require('../models/User');
const servers = new Set();
function attach(server) {
  const origins = [process.env.CLIENT_URL, ...(process.env.CLIENT_ORIGINS || '').split(',')]
    .filter(Boolean)
    .map((v) => new URL(v.trim()).origin);
  const io = new Server(server, {
    cors: { origin: origins, credentials: true },
    allowRequest: (req, done) =>
      done(null, !req.headers.origin || origins.includes(req.headers.origin)),
  });
  io.use(async (socket, next) => {
    try {
      const cookie = socket.request.headers.cookie || '',
        token = cookie
          .split(';')
          .map((s) => s.trim())
          .find((s) => s.startsWith('bizlaunch_session='))
          ?.slice('bizlaunch_session='.length);
      if (!token) throw new Error('Sign in required');
      const payload = jwt.verify(decodeURIComponent(token), process.env.JWT_SECRET, {
        algorithms: ['HS256'],
      });
      const user = await User.findById(payload.userId);
      if (
        !user ||
        user.status !== 'active' ||
        !user.emailVerified ||
        user.tokenVersion !== payload.version
      )
        throw new Error('Session unavailable');
      socket.userId = user.id;
      socket.version = payload.version;
      socket.expiresAt = payload.exp * 1000;
      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });
  io.on('connection', (socket) => {
    socket.join('user:' + socket.userId);
    const timer = setInterval(async () => {
      try {
        const user = await User.findById(socket.userId);
        if (
          !user ||
          user.status !== 'active' ||
          !user.emailVerified ||
          user.tokenVersion !== socket.version ||
          Date.now() >= socket.expiresAt
        )
          socket.disconnect(true);
      } catch {
        socket.disconnect(true);
      }
    }, 30000);
    timer.unref();
    socket.on('disconnect', () => clearInterval(timer));
  });
  servers.add(io);
  server.on('close', () => servers.delete(io));
  return io;
}
function publish(user, notification) {
  for (const io of servers)
    io.to('user:' + String(user)).emit('notification', {
      title: notification.title,
      message: notification.message,
      link: notification.link,
    });
}
module.exports = { attach, publish };

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { bus } = require('../utils/cache');

function createSocketIOServer(httpServer) {
  const io = new Server(httpServer, {
    path: '/socket.io/',
    cors: {
      origin: (origin, cb) => cb(null, true),
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Auth middleware (JWT in query or header)
  io.use((socket, next) => {
    try {
      const token = socket.handshake.query?.token || socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(); // allow public connections; restrict sensitive rooms later
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: decoded.id };
      next();
    } catch (e) {
      // Proceed without auth for public odds; client features can still subscribe
      next();
    }
  });

  // Namespaces/rooms
  io.on('connection', (socket) => {
    // Subscribe to live odds for a match
    socket.on('subscribe:match', (matchId) => {
      if (!matchId) return;
      socket.join(`match:${matchId}`);
    });

    socket.on('unsubscribe:match', (matchId) => {
      if (!matchId) return;
      socket.leave(`match:${matchId}`);
    });

    // Subscribe to global live matches feed
    socket.on('subscribe:live', () => socket.join('live'));
    socket.on('unsubscribe:live', () => socket.leave('live'));

    // Subscribe to user-scoped updates (bets, balance, etc.)
    socket.on('subscribe:user', (userId) => {
      if (!userId) return;
      socket.join(`user:${userId}`);
    });
    socket.on('unsubscribe:user', (userId) => {
      if (!userId) return;
      socket.leave(`user:${userId}`);
    });

    // Auto-join authenticated user's room
    if (socket.user?.id) {
      socket.join(`user:${socket.user.id}`);
    }
  });

  // Broadcast hooks via event bus
  bus.on('odds:update', ({ matchId, delta }) => {
    if (!matchId || !delta) return;
    io.to(`match:${matchId}`).emit('oddsUpdate', { matchId, delta });
    io.to('live').emit('oddsUpdate', { matchId, delta });
  });

  bus.on('matches:live:update', (payload) => {
    io.to('live').emit('matchUpdate', payload);
  });

  bus.on('matches:new', (match) => io.emit('newMatch', match));
  bus.on('matches:deleted', (matchId) => io.emit('matchDeleted', matchId));

  // Forward bet updates to user rooms
  bus.on('bets:update', (payload) => {
    const { userId } = payload || {};
    if (!userId) return;
    io.to(`user:${userId}`).emit('betUpdate', payload);
  });

  return io;
}

module.exports = { createSocketIOServer };
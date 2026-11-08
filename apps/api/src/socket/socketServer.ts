import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import { User } from '../models/User.js';

let io: Server | null = null;

export function initSocketServer(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: [
        config.cors.origin,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        /\.ngrok-free\.app$/,
        /\.ngrok\.app$/,
        /\.ngrok\.io$/
      ],
      credentials: true
    }
  });

  // Socket.IO authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token as string, config.jwt.accessSecret) as {
        userId: string;
        role: string;
        tenantId?: string;
      };

      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        return next(new Error('User unauthorized or deactivated'));
      }

      (socket as any).user = user;
      (socket as any).tenantId = user.tenantId ? user.tenantId.toString() : 'PLATFORM';
      next();
    } catch (err) {
      next(new Error('Invalid socket credentials'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    const tenantId = (socket as any).tenantId;

    logger.info({ userId: user._id, tenantId }, 'Authenticated WebSocket client connected');

    // Automatically join tenant room for multi-tenant data broadcast isolation
    if (tenantId && tenantId !== 'PLATFORM') {
      socket.join(`tenant_${tenantId}`);
    } else {
      socket.join('platform_admin');
    }

    // Join specific machine monitoring room
    socket.on('machine:subscribe', (machineId: string) => {
      socket.join(`machine_${machineId}`);
    });

    socket.on('machine:unsubscribe', (machineId: string) => {
      socket.leave(`machine_${machineId}`);
    });

    socket.on('disconnect', () => {
      logger.info({ userId: user._id }, 'WebSocket client disconnected');
    });
  });

  return io;
}

export function getSocketServer(): Server | null {
  return io;
}

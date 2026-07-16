import type { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { NS, rooms } from './rooms';
import type { AppIOServer } from './socket';

// Wraps an emit so a serialization/room error is logged, never thrown into the event loop.
const safe = (fn: () => void, evt: string): void => {
  try {
    fn();
  } catch (err) {
    logger.error({ err, evt }, 'Realtime emit failed');
  }
};

// Wires the domain event bus to Socket.IO. Called only when WS is enabled (see ./index.ts).
export const initRealtimeGateway = (io: AppIOServer, _prisma: PrismaClient): void => {
  const usersNs = io.of(NS.USERS);
  const adminNs = io.of(NS.ADMIN);

  // EXTENSION POINT (realtime): join each connection to the rooms it should receive.
  usersNs.on('connection', (socket) => {
    const userId = socket.data.user?.id;
    if (userId) void socket.join(rooms.user(userId));
  });

  adminNs.on('connection', () => {
    // e.g. void socket.join('admin');
  });

  // EXTENSION POINT (realtime): relay domain events to the right room, e.g.
  // eventBus.on('resource:updated', (p) =>
  //   safe(
  //     () => usersNs.to(rooms.user(p.userId)).emit('resource:updated', p),
  //     'resource:updated',
  //   ),
  // );
  void safe;

  logger.info('Realtime gateway initialized');
};

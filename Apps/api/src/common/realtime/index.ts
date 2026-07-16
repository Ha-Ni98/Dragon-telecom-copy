import type { Server as HttpServer } from 'node:http';
import type { PrismaClient } from '@prisma/client';
import { UserRole } from '@your-app/contract';
import { env } from '../../env';
import { logger } from '../config/logger';
import { createSocketServer, type AppIOServer } from './socket';
import { authNamespace } from './socket-auth';
import { initRealtimeGateway } from './realtime-gateway';
import { NS } from './rooms';

// Realtime is OPT-IN. Toggle with WS_ENABLED in .env.
//
// To REMOVE realtime entirely:
//   1. delete this `realtime/` folder,
//   2. delete the `initRealtime(...)` call + import in src/server.ts,
//   3. remove WS_ENABLED / WS_PATH from src/env.ts and .env.example,
//   4. `npm uninstall socket.io socket.io-client`.
//
// Returns the io server when enabled (so server.ts can close it on shutdown), else null.
export function initRealtime(httpServer: HttpServer, prisma: PrismaClient): AppIOServer | null {
  if (!env.WS_ENABLED) {
    logger.info('Realtime disabled (WS_ENABLED=false)');
    return null;
  }

  const io = createSocketServer(httpServer);

  // EXTENSION POINT (auth): guard each namespace with the roles allowed to connect.
  io.of(NS.USERS).use(authNamespace([UserRole.ADMIN, UserRole.USER]));
  io.of(NS.ADMIN).use(authNamespace([UserRole.ADMIN]));

  initRealtimeGateway(io, prisma);
  return io;
}

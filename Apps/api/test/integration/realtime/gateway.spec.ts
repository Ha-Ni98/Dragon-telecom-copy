import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import { io as Client } from 'socket.io-client';
import { app } from '../../../src/app';
import { prisma } from '../../../src/common/db/prisma';
import { createSocketServer } from '../../../src/common/realtime/socket';
import type { AppIOServer } from '../../../src/common/realtime/socket';
import { authNamespace } from '../../../src/common/realtime/socket-auth';
import { initRealtimeGateway } from '../../../src/common/realtime/realtime-gateway';
import { NS } from '../../../src/common/realtime/rooms';
import { UserRole } from '@your-app/contract';
import { faker } from '@faker-js/faker';
import { mintToken } from '../../fixtures/auth.fixture';

// Realtime is opt-in — this suite only runs when WS is turned on. Keep it as the pattern
// for testing your own gateway wiring once you add real events (EXTENSION POINT (realtime)).
const wsEnabled = process.env['WS_ENABLED'] === 'true';

let baseUrl: string;
let httpServer: HttpServer;
let ioServer: AppIOServer;

beforeAll(async () => {
  if (!wsEnabled) return;
  httpServer = createServer(app);
  ioServer = createSocketServer(httpServer);
  ioServer.of(NS.USERS).use(authNamespace([UserRole.ADMIN, UserRole.USER]));
  ioServer.of(NS.ADMIN).use(authNamespace([UserRole.ADMIN]));
  initRealtimeGateway(ioServer, prisma);

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const addr = httpServer.address() as { port: number };
  baseUrl = `http://localhost:${addr.port}`;
});

afterAll(async () => {
  if (!wsEnabled) return;
  await new Promise<void>((resolve) => {
    ioServer.close(() => httpServer.close(() => resolve()));
  });
});

describe.skipIf(!wsEnabled)('Realtime Gateway (baseline auth)', () => {
  it('/admin rejects a missing token (UNAUTHORIZED) and a non-admin token (FORBIDDEN)', async () => {
    const noTokenClient = Client(`${baseUrl}${NS.ADMIN}`, { reconnection: false });
    const noTokenErr = await new Promise<Error>((r) => noTokenClient.once('connect_error', r));
    expect(noTokenErr.message).toBe('UNAUTHORIZED');
    noTokenClient.disconnect();

    const userToken = mintToken({ id: faker.string.uuid(), role: UserRole.USER });
    const wrongRoleClient = Client(`${baseUrl}${NS.ADMIN}`, {
      auth: { token: userToken },
      reconnection: false,
    });
    const wrongRoleErr = await new Promise<Error>((r) => wrongRoleClient.once('connect_error', r));
    expect(wrongRoleErr.message).toBe('FORBIDDEN');
    wrongRoleClient.disconnect();
  });

  it('/users accepts a valid token and connects', async () => {
    const token = mintToken({ id: faker.string.uuid(), role: UserRole.USER });
    const client = Client(`${baseUrl}${NS.USERS}`, { auth: { token }, reconnection: false });
    await new Promise<void>((r) => client.once('connect', r));
    expect(client.connected).toBe(true);
    client.disconnect();
  });
});

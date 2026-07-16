import { createServer } from 'node:http';
import { app } from './app';
import { env } from './env';
import { prisma } from './common/db/prisma';
import { logger } from './common/config/logger';
import { initRealtime } from './common/realtime';

const httpServer = createServer(app);

// Realtime is opt-in — returns null when WS_ENABLED=false (see common/realtime/index.ts).
const io = initRealtime(httpServer, prisma);

async function main(): Promise<void> {
  await prisma.$connect();
  httpServer.listen(env.PORT, () => logger.info(`API listening on port ${env.PORT}`));
}

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down');
  io?.close();
  httpServer.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

void main();

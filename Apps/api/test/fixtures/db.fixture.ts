import { prisma } from '../../src/common/db/prisma';

export const resetDatabase = async (): Promise<void> => {
  if (process.env['NODE_ENV'] !== 'test') {
    throw new Error('resetDatabase blocked outside NODE_ENV=test');
  }

  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;

  if (tables.length === 0) return;

  const tableList = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
};

import { prisma } from '../../src/common/db/prisma';

export const resetDatabase = async (): Promise<void> => {
  if (process.env['NODE_ENV'] !== 'test') {
    throw new Error('resetDatabase blocked outside NODE_ENV=test');
  }
  // Truncate in dependency order (children before parents).
  // EXTENSION POINT (modules): add each new table here.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "RefreshToken",
      "DeliveryCompany",
      "User"
    RESTART IDENTITY CASCADE
  `);
};

import { prisma } from '../src/common/db/prisma';
import { logger } from '../src/common/config/logger';
import { PAGES_REGISTRY } from './pages.registry';

async function main(): Promise<void> {
  for (const page of PAGES_REGISTRY) {
    await prisma.page.upsert({
      where: { key: page.key },
      update: { label: page.label, group: page.group, scope: page.scope },
      create: page,
    });
  }
  logger.info({ count: PAGES_REGISTRY.length }, 'Seeded pages');
}

main()
  .catch((err) => {
    logger.error({ err }, 'Seed failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PageGroup, PageKey, PageScope } from '@dragon-telecom/contract';
import { prisma } from '../src/common/db/prisma';
import { logger } from '../src/common/config/logger';

// Seeded `Page` registry — STAFF-scope only (see plan-identity.md §7.1). Every key/group
// comes from the contract's PageKey/PageGroup enums, never a literal string.
const PAGES: { key: PageKey; label: string; group: PageGroup; scope: PageScope }[] = [
  { key: PageKey.STAFF_POS, label: 'POS', group: PageGroup.POS, scope: PageScope.STAFF },
  { key: PageKey.STAFF_POS_CLIENTS, label: 'POS Clients', group: PageGroup.POS, scope: PageScope.STAFF },
  { key: PageKey.STAFF_PRODUCTS, label: 'Products', group: PageGroup.CATALOG, scope: PageScope.STAFF },
  { key: PageKey.STAFF_ORDERS, label: 'Orders', group: PageGroup.ORDERS, scope: PageScope.STAFF },
  { key: PageKey.STAFF_SALES, label: 'Sales', group: PageGroup.SALES, scope: PageScope.STAFF },
  { key: PageKey.STAFF_INVOICES, label: 'Invoices', group: PageGroup.BILLING, scope: PageScope.STAFF },
  { key: PageKey.STAFF_REPAIRS, label: 'Repairs', group: PageGroup.REPAIRS, scope: PageScope.STAFF },
];

async function main(): Promise<void> {
  for (const page of PAGES) {
    await prisma.page.upsert({
      where: { key: page.key },
      update: { label: page.label, group: page.group, scope: page.scope },
      create: page,
    });
  }
  logger.info({ count: PAGES.length }, 'Seeded pages');
}

main()
  .catch((err) => {
    logger.error({ err }, 'Seed failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

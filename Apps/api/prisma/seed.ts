import { DocType } from '@dragon-telecom/contract';
import { prisma } from '../src/common/db/prisma';
import { logger } from '../src/common/config/logger';
import { PAGES_REGISTRY } from './pages.registry';
import { WILAYAS_REGISTRY } from './wilayas.registry';

// One row per DocType — every prefix/nextSequence key SequenceService.nextNumber may read.
const INVOICING_PREFIXES: Record<DocType, string> = {
  [DocType.INVOICE]: 'FAC',
  [DocType.SALE]: 'SAL',
  [DocType.ORDER]: 'ORD',
  [DocType.REPAIR]: 'REP',
  [DocType.SUPPLIER_INVOICE]: 'SUP',
  [DocType.ADJUSTMENT]: 'ADJ',
  [DocType.POS_CLIENT]: 'POS',
  [DocType.CLIENT]: 'CLI',
};

const NEXT_SEQUENCES: Record<DocType, number> = Object.fromEntries(
  Object.values(DocType).map((docType) => [docType, 1]),
) as Record<DocType, number>;

// Keyed by the SettingsDto section name (Setting.key mirrors the DTO key — plan §1.2).
const DEFAULT_SETTINGS: Record<string, unknown> = {
  store: { name: 'Dragon Telecom' },
  invoicing: { prefixes: INVOICING_PREFIXES, nextSequences: NEXT_SEQUENCES },
  delivery: { defaultHome: 500, defaultOffice: 300 },
  storefront: { featuredProductIds: [] },
};

async function seedPages(): Promise<void> {
  for (const page of PAGES_REGISTRY) {
    await prisma.page.upsert({
      where: { key: page.key },
      update: { label: page.label, group: page.group, scope: page.scope },
      create: page,
    });
  }
  logger.info({ count: PAGES_REGISTRY.length }, 'Seeded pages');
}

async function seedGeography(): Promise<void> {
  let communeCount = 0;
  for (const wilayaSeed of WILAYAS_REGISTRY) {
    const wilaya = await prisma.wilaya.upsert({
      where: { wilayaCode: wilayaSeed.wilayaCode },
      update: { frName: wilayaSeed.frName, arName: wilayaSeed.arName },
      create: {
        wilayaCode: wilayaSeed.wilayaCode,
        frName: wilayaSeed.frName,
        arName: wilayaSeed.arName,
      },
    });
    for (const communeSeed of wilayaSeed.communes) {
      await prisma.commune.upsert({
        where: { communeCode: communeSeed.communeCode },
        update: { frName: communeSeed.frName, arName: communeSeed.arName, wilayaId: wilaya.id },
        create: {
          communeCode: communeSeed.communeCode,
          frName: communeSeed.frName,
          arName: communeSeed.arName,
          wilayaId: wilaya.id,
        },
      });
      communeCount += 1;
    }
  }
  logger.info(
    { wilayas: WILAYAS_REGISTRY.length, communes: communeCount },
    'Seeded geography (partial set — see plan-platform.md §7.1)',
  );
}

// Never overwrites an admin-edited row — only creates the 4 sections when missing, so
// SequenceService's `invoicing` row-lock target always exists on a fresh DB (plan §7.1).
async function seedSettings(): Promise<void> {
  let created = 0;
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await prisma.setting.findUnique({ where: { key } });
    if (existing) continue;
    await prisma.setting.create({ data: { key, value: JSON.stringify(value) } });
    created += 1;
  }
  logger.info({ created, total: Object.keys(DEFAULT_SETTINGS).length }, 'Seeded settings');
}

async function main(): Promise<void> {
  await seedPages();
  await seedGeography();
  await seedSettings();
}

main()
  .catch((err) => {
    logger.error({ err }, 'Seed failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

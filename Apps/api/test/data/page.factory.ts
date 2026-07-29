import { prisma } from '../../src/common/db/prisma';
import { PAGES_REGISTRY } from '../../prisma/pages.registry';

// Seeds the same canonical STAFF-scope registry as prisma/seed.ts (single source of truth:
// prisma/pages.registry.ts) — for integration tests that need real Page rows to reference.
export const seedPages = () =>
  Promise.all(
    PAGES_REGISTRY.map((page) =>
      prisma.page.upsert({
        where: { key: page.key },
        update: { label: page.label, group: page.group, scope: page.scope },
        create: page,
      }),
    ),
  );

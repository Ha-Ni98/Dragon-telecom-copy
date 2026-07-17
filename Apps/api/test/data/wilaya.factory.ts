import { prisma } from '../../src/common/db/prisma';
import { WILAYAS_REGISTRY, type WilayaSeed } from '../../prisma/wilayas.registry';

export type SeededWilaya = {
  wilayaId: string;
  wilayaCode: string;
  communes: { communeId: string; communeCode: string }[];
};

// Persists a subset of the canonical registry (idempotent upsert by code — safe to call from
// multiple integration specs/beforeEach hooks without violating the unique constraints).
export const seedWilayas = async (subset: WilayaSeed[] = WILAYAS_REGISTRY): Promise<SeededWilaya[]> => {
  const result: SeededWilaya[] = [];
  for (const wilayaSeed of subset) {
    const wilaya = await prisma.wilaya.upsert({
      where: { wilayaCode: wilayaSeed.wilayaCode },
      update: { frName: wilayaSeed.frName, arName: wilayaSeed.arName },
      create: { wilayaCode: wilayaSeed.wilayaCode, frName: wilayaSeed.frName, arName: wilayaSeed.arName },
    });

    const communes: SeededWilaya['communes'] = [];
    for (const communeSeed of wilayaSeed.communes) {
      const commune = await prisma.commune.upsert({
        where: { communeCode: communeSeed.communeCode },
        update: { frName: communeSeed.frName, arName: communeSeed.arName, wilayaId: wilaya.id },
        create: {
          communeCode: communeSeed.communeCode,
          frName: communeSeed.frName,
          arName: communeSeed.arName,
          wilayaId: wilaya.id,
        },
      });
      communes.push({ communeId: commune.id, communeCode: commune.communeCode });
    }

    result.push({ wilayaId: wilaya.id, wilayaCode: wilaya.wilayaCode, communes });
  }
  return result;
};

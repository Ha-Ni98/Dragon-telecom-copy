import { UpdateSettingsSchema, type UpdateSettingsCommand } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';
import { DEFAULT_SETTINGS } from '../../prisma/settings-defaults';

export const updateSettingsPayload = (overrides: Partial<UpdateSettingsCommand> = {}): UpdateSettingsCommand =>
  UpdateSettingsSchema.parse({ ...overrides });

// Writes all 4 default Setting rows unconditionally (unlike prisma/seed.ts's create-if-missing
// guard) — tests want a deterministic, known-good baseline every run, not idempotent-preserve.
export const seedSettings = async (): Promise<void> => {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) },
    });
  }
};

import { prisma } from '../src/common/db/prisma';
import { logger } from '../src/common/config/logger';
import { PAGES_REGISTRY } from './pages.registry';
import { WILAYAS_REGISTRY } from './wilayas.registry';
import { DEFAULT_SETTINGS } from './settings-defaults';
import { hashPassword } from '@common/utils/password.utils';
import { UserType as PrismaUserType } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';


// Common Var for admin clients
const userName = "admin";
const password = "123456";

// Common Var for geography data
interface RawCommune {
  id: number;
  nameFr: string;
  nameAr: string;
}

interface RawWilaya {
  wilayaCode: number;
  nameFr: string;
  nameAr: string;
  communes: RawCommune[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = resolve(__dirname, './wilayas-with-municipalities.json');
// wilayaCode 1 -> "01"; commune codes are made globally unique by prefixing the
// wilaya code, because the raw commune `id` restarts at 1 within each wilaya.
const wilayaCodeOf = (code: number): string => String(code).padStart(2, '0');
const communeCodeOf = (wilayaCode: number, communeId: number): string =>
  `${wilayaCodeOf(wilayaCode)}-${String(communeId).padStart(3, '0')}`;

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
  
  // Delete all existing wilayas and communes to ensure a clean slate before seeding new data
  await prisma.commune.deleteMany({});
  await prisma.wilaya.deleteMany({});
  
  // Load wilayas and communes from the JSON file
  const raw = readFileSync(JSON_PATH, 'utf-8');
  const wilayas = JSON.parse(raw) as RawWilaya[];

  let wilayaCount = 0;
  let communeCount = 0;

  for (const w of wilayas) {
    const wilayaCode = wilayaCodeOf(w.wilayaCode);

    const wilaya = await prisma.wilaya.upsert({
      where: { wilayaCode },
      update: { frName: w.nameFr, arName: w.nameAr },
      create: { wilayaCode, frName: w.nameFr, arName: w.nameAr },
    });
    wilayaCount += 1;

    await Promise.all(
      w.communes.map((c) => {
        const communeCode = communeCodeOf(w.wilayaCode, c.id);
        return prisma.commune.upsert({
          where: { communeCode },
          update: { frName: c.nameFr, arName: c.nameAr, wilayaId: wilaya.id },
          create: {
            communeCode,
            wilayaId: wilaya.id,
            frName: c.nameFr,
            arName: c.nameAr,
          },
        });
      }),
    );
    communeCount += w.communes.length;
    }
  
    console.log(`✓ Loaded ${wilayaCount} wilayas and ${communeCount} communes.`);
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

  // Create admin user
  let createdUser;
  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { username: userName } });
  if (!existing) {
    createdUser = await prisma.user.create({
      data: {
        username: "admin",
        passwordHash,
        type: "ADMIN" as PrismaUserType,
            staff: {
              create: {
                firstName: "Admin", 
                lastName: "User",
                phone: null,
                jobTitle: null,
              },
            }
            
          
        }});
  } else {
    await prisma.user.update({
      where: { username: userName },
      data: {
        passwordHash,
        type: "ADMIN" as PrismaUserType,
      },
    });
  }
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

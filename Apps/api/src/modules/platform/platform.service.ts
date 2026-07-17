import ExcelJS from 'exceljs';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  FeeSource,
  SettingsResponseSchema,
  type AdminFeesDto,
  type DocType,
  type FeeDto,
  type FeeQuery,
  type FeesExportQuery,
  type PublicSettingsDto,
  type SettingsDto,
  type UpdateSettingsCommand,
  type UpsertFeesCommand,
  type WilayaDto,
} from '@dragon-telecom/contract';
import { BadRequestError, ConflictError } from '@common/errors';
import { eventBus } from '@common/events/event-bus';
import { DEFAULT_SETTINGS } from '../../../prisma/settings-defaults';
import type {
  ExportFeesResult,
  IDeliveryFeeService,
  IPlatformService,
  ImportFeesResult,
  ISequenceService,
} from './platform.interface';
import { PlatformMapper } from './platform.mapper';

type SettingsSection = keyof SettingsDto;
const SETTINGS_SECTIONS: SettingsSection[] = ['store', 'invoicing', 'delivery', 'storefront'];

// Column layout shared (by convention, not by import — one is production output, the other is
// test-only input) with test/data/fees-import.fixture.ts's FEES_IMPORT_HEADERS.
const FEE_ROW_HEADERS = ['wilayaCode', 'communeCode', 'deliveryHome', 'deliveryOffice'] as const;

const WILAYA_INCLUDE = { communes: { orderBy: { communeCode: 'asc' } } } satisfies Prisma.WilayaInclude;

type ResolvedFee = { deliveryHome: number; deliveryOffice: number; source: FeeSource };

// Shared by PlatformService.resolveFee (public route) and DeliveryFeeService.resolve (injected
// into orders) — module-level, not a class method, since the two live in separate classes
// (plan §3.6: "shares the private resolver with resolveFee").
async function resolveFeeAndSource(
  prisma: PrismaClient,
  wilayaId: string,
  communeId: string | null,
): Promise<ResolvedFee> {
  if (communeId) {
    const communeFee = await prisma.deliveryFee.findUnique({ where: { wilayaId_communeId: { wilayaId, communeId } } });
    if (communeFee) {
      return {
        deliveryHome: communeFee.deliveryHome.toNumber(),
        deliveryOffice: communeFee.deliveryOffice.toNumber(),
        source: FeeSource.COMMUNE,
      };
    }
  }

  // findFirst, not findUnique: Postgres treats NULL as distinct in the (wilayaId, communeId)
  // unique constraint, so a "wilaya-level" row (communeId = null) isn't actually DB-enforced
  // unique — see upsertFeeRow's comment for the write-side implication.
  const wilayaFee = await prisma.deliveryFee.findFirst({ where: { wilayaId, communeId: null } });
  if (wilayaFee) {
    return {
      deliveryHome: wilayaFee.deliveryHome.toNumber(),
      deliveryOffice: wilayaFee.deliveryOffice.toNumber(),
      source: FeeSource.WILAYA,
    };
  }

  const deliverySetting = await prisma.setting.findUnique({ where: { key: 'delivery' } });
  const delivery = deliverySetting
    ? (JSON.parse(deliverySetting.value) as SettingsDto['delivery'])
    : DEFAULT_SETTINGS.delivery;
  return { deliveryHome: delivery.defaultHome, deliveryOffice: delivery.defaultOffice, source: FeeSource.DEFAULT };
}

// Upserts one DeliveryFee row. communeId != null: the compound unique key works normally
// (Postgres enforces uniqueness for non-null values), so a plain Prisma upsert suffices.
// communeId == null: Postgres does NOT enforce (wilayaId, NULL) as unique (NULL <> NULL in a
// unique index), so Prisma's compound-key upsert would silently INSERT a duplicate wilaya-level
// row on every call instead of updating the existing one — found during Sprint P3 execution
// (verified directly against Postgres), worked around here with a manual find-then-write
// instead of a schema migration (see the Sprint P3 report for the tradeoff).
async function upsertFeeRow(
  tx: Prisma.TransactionClient,
  row: { wilayaId: string; communeId: string | null; deliveryHome: number; deliveryOffice: number },
): Promise<void> {
  if (row.communeId == null) {
    const existing = await tx.deliveryFee.findFirst({ where: { wilayaId: row.wilayaId, communeId: null } });
    if (existing) {
      await tx.deliveryFee.update({
        where: { id: existing.id },
        data: { deliveryHome: row.deliveryHome, deliveryOffice: row.deliveryOffice },
      });
    } else {
      await tx.deliveryFee.create({
        data: { wilayaId: row.wilayaId, communeId: null, deliveryHome: row.deliveryHome, deliveryOffice: row.deliveryOffice },
      });
    }
    return;
  }

  await tx.deliveryFee.upsert({
    where: { wilayaId_communeId: { wilayaId: row.wilayaId, communeId: row.communeId } },
    update: { deliveryHome: row.deliveryHome, deliveryOffice: row.deliveryOffice },
    create: {
      wilayaId: row.wilayaId,
      communeId: row.communeId,
      deliveryHome: row.deliveryHome,
      deliveryOffice: row.deliveryOffice,
    },
  });
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// Pure, recursive leaf-diff — narrates settings.changed "old → new" (spec BL 3) without needing
// a bespoke description per section. Records (invoicing.prefixes/nextSequences) get walked one
// level deeper, per-DocType; arrays (storefront.featuredProductIds) compare whole-value.
function diffLeaves(before: unknown, after: unknown, path: string, out: string[]): void {
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      diffLeaves(before[key], after[key], path ? `${path}.${key}` : key, out);
    }
    return;
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    out.push(`${path}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  }
}

function describeSettingsChange(before: SettingsDto, after: SettingsDto): string {
  const diffs: string[] = [];
  diffLeaves(before, after, '', diffs);
  return diffs.length > 0 ? `Settings updated: ${diffs.join('; ')}` : 'Settings updated (no changes)';
}

// Zod's `.optional()` infers `{ key?: T[K] | undefined }` (the value type itself includes
// `undefined`, not just the `?` key marker `Partial<T>` produces) — under
// exactOptionalPropertyTypes those two shapes aren't interchangeable, so `Partial<T>` is the
// wrong parameter type for a `*SettingsInputSchema`-shaped patch.
type OptionalPatch<T> = { [K in keyof T]?: T[K] | undefined };

// Field-by-field merge (only overwrites patch keys that are actually present and non-undefined)
// — a plain `{...base, ...patch}` spread type-widens every field to `T[K] | undefined` under
// exactOptionalPropertyTypes, even though every `UpdateSettingsCommand` leaf is independently
// optional/omitted-when-absent at runtime. This keeps the merge both runtime-correct and typed
// as plain `T`.
function mergeDefined<T extends object>(base: T, patch: OptionalPatch<T> | undefined): T {
  if (!patch) return base;
  const result = { ...base };
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const value = patch[key];
    if (value !== undefined) result[key] = value;
  }
  return result;
}

export class PlatformService implements IPlatformService {
  constructor(private prisma: PrismaClient) {}

  async listWilayas(): Promise<WilayaDto[]> {
    const wilayas = await this.loadWilayasWithCommunes();
    return wilayas.map((wilaya) => PlatformMapper.toWilayaDto(wilaya));
  }

  async resolveFee(query: FeeQuery): Promise<FeeDto> {
    const resolved = await resolveFeeAndSource(this.prisma, query.wilayaId, query.communeId ?? null);
    return PlatformMapper.toFeeDto(resolved.deliveryHome, resolved.deliveryOffice, resolved.source);
  }

  async getAdminFees(): Promise<AdminFeesDto> {
    const [wilayas, fees, settings] = await Promise.all([
      this.loadWilayasWithCommunes(),
      this.prisma.deliveryFee.findMany(),
      this.getSettings(),
    ]);
    return PlatformMapper.toAdminFeesDto(wilayas, fees, settings.delivery);
  }

  async upsertFees(cmd: UpsertFeesCommand): Promise<AdminFeesDto> {
    await this.validateFeeRows(cmd.rows);

    await this.prisma.$transaction(async (tx) => {
      for (const row of cmd.rows) {
        await upsertFeeRow(tx, { wilayaId: row.wilayaId, communeId: row.communeId ?? null, deliveryHome: row.deliveryHome, deliveryOffice: row.deliveryOffice });
      }
    });

    eventBus.emit('deliveryFees.changed', { description: `Updated ${cmd.rows.length} delivery fee row(s)` });

    return this.getAdminFees();
  }

  async importFees(file: Buffer): Promise<ImportFeesResult> {
    const workbook = new ExcelJS.Workbook();
    // exceljs's own index.d.ts declares a module-scoped `interface Buffer extends ArrayBuffer`
    // that shadows Node's real Buffer inside its type file — `load()`'s declared parameter type
    // is that shadowed one, not Node's. Real runtime behavior accepts a genuine Node Buffer
    // fine; this is a 3rd-party typing defect, not a real type-safety concern here.
    await workbook.xlsx.load(file as never);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestError('Import file has no worksheet');

    const [wilayas, communes] = await Promise.all([this.prisma.wilaya.findMany(), this.prisma.commune.findMany()]);
    const wilayaByCode = new Map(wilayas.map((wilaya) => [wilaya.wilayaCode, wilaya]));
    const communeByCode = new Map(communes.map((commune) => [commune.communeCode, commune]));

    type ParsedRow = { wilayaId: string; communeId: string | null; deliveryHome: number; deliveryOffice: number };
    const parsedRows: ParsedRow[] = [];
    const errors: { row: number; message: string }[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header

      const values = row.values as unknown[];
      const wilayaCode = values[1] != null ? String(values[1]).trim() : '';
      const communeCodeRaw = values[2];
      const communeCode = communeCodeRaw != null && String(communeCodeRaw).trim() !== '' ? String(communeCodeRaw).trim() : null;
      const homeRaw = values[3];
      const officeRaw = values[4];

      const wilaya = wilayaByCode.get(wilayaCode);
      if (!wilaya) {
        errors.push({ row: rowNumber, message: `Unknown wilayaCode: ${wilayaCode}` });
        return;
      }

      let communeId: string | null = null;
      if (communeCode) {
        const commune = communeByCode.get(communeCode);
        if (!commune) {
          errors.push({ row: rowNumber, message: `Unknown communeCode: ${communeCode}` });
          return;
        }
        if (commune.wilayaId !== wilaya.id) {
          errors.push({ row: rowNumber, message: `Commune ${communeCode} does not belong to wilaya ${wilayaCode}` });
          return;
        }
        communeId = commune.id;
      }

      const deliveryHome = Number(homeRaw);
      const deliveryOffice = Number(officeRaw);
      if (!Number.isFinite(deliveryHome) || deliveryHome < 0) {
        errors.push({ row: rowNumber, message: `Invalid deliveryHome: ${String(homeRaw)}` });
        return;
      }
      if (!Number.isFinite(deliveryOffice) || deliveryOffice < 0) {
        errors.push({ row: rowNumber, message: `Invalid deliveryOffice: ${String(officeRaw)}` });
        return;
      }

      parsedRows.push({ wilayaId: wilaya.id, communeId, deliveryHome, deliveryOffice });
    });

    if (errors.length > 0) {
      throw new BadRequestError('Fees import failed validation — no rows were written', { errors });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const row of parsedRows) {
        await upsertFeeRow(tx, row);
      }
    });

    eventBus.emit('deliveryFees.changed', { description: `Imported ${parsedRows.length} delivery fee row(s)` });

    return { imported: parsedRows.length };
  }

  async exportFees(query: FeesExportQuery): Promise<ExportFeesResult> {
    const fees = await this.prisma.deliveryFee.findMany({
      include: { wilaya: true, commune: true },
      orderBy: [{ wilaya: { wilayaCode: 'asc' } }, { commune: { communeCode: 'asc' } }],
    });

    const rows = fees.map((fee) => ({
      wilayaCode: fee.wilaya.wilayaCode,
      communeCode: fee.commune?.communeCode ?? null,
      deliveryHome: fee.deliveryHome.toNumber(),
      deliveryOffice: fee.deliveryOffice.toNumber(),
    }));

    const format = query.format ?? 'excel';

    if (format === 'json') {
      return { filename: 'delivery-fees.json', mime: 'application/json', body: JSON.stringify(rows) };
    }

    if (format === 'csv') {
      const lines = [
        FEE_ROW_HEADERS.join(','),
        ...rows.map((row) => [row.wilayaCode, row.communeCode ?? '', row.deliveryHome, row.deliveryOffice].join(',')),
      ];
      return { filename: 'delivery-fees.csv', mime: 'text/csv', body: lines.join('\n') };
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Fees');
    sheet.addRow([...FEE_ROW_HEADERS]);
    for (const row of rows) sheet.addRow([row.wilayaCode, row.communeCode, row.deliveryHome, row.deliveryOffice]);
    // writeBuffer() is typed to return exceljs's own shadowed `Buffer` (see the load() comment
    // above); at runtime it's a real Node Buffer (StreamBuf.read()) — cast to the real type.
    const body = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    return {
      filename: 'delivery-fees.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body,
    };
  }

  async getSettings(): Promise<SettingsDto> {
    const rows = await this.prisma.setting.findMany();
    return PlatformMapper.toSettingsDto(rows);
  }

  async updateSettings(cmd: UpdateSettingsCommand): Promise<SettingsDto> {
    const before = await this.getSettings();

    const touchedSections = SETTINGS_SECTIONS.filter((section) => cmd[section] !== undefined);
    if (touchedSections.length === 0) return before;

    const after: SettingsDto = {
      store: mergeDefined(before.store, cmd.store),
      invoicing: mergeDefined(before.invoicing, cmd.invoicing),
      delivery: mergeDefined(before.delivery, cmd.delivery),
      storefront: mergeDefined(before.storefront, cmd.storefront),
    };

    if (cmd.invoicing?.nextSequences) {
      for (const [docType, nextValue] of Object.entries(cmd.invoicing.nextSequences)) {
        const previousValue = before.invoicing.nextSequences[docType as DocType];
        if (previousValue !== undefined && nextValue < previousValue) {
          throw new ConflictError(
            `SEQUENCE_DECREASE_FORBIDDEN: ${docType} next sequence cannot decrease (${previousValue} → ${nextValue})`,
          );
        }
      }
    }

    await this.prisma.$transaction(
      touchedSections.map((section) =>
        this.prisma.setting.upsert({
          where: { key: section },
          update: { value: JSON.stringify(after[section]) },
          create: { key: section, value: JSON.stringify(after[section]) },
        }),
      ),
    );

    eventBus.emit('settings.changed', { description: describeSettingsChange(before, after) });

    return SettingsResponseSchema.parse(after);
  }

  async getPublicSettings(): Promise<PublicSettingsDto> {
    const settings = await this.getSettings();
    return PlatformMapper.toPublicSettingsDto(settings);
  }

  private async loadWilayasWithCommunes() {
    return this.prisma.wilaya.findMany({ include: WILAYA_INCLUDE, orderBy: { wilayaCode: 'asc' } });
  }

  private async validateFeeRows(rows: UpsertFeesCommand['rows']): Promise<void> {
    const wilayaIds = [...new Set(rows.map((row) => row.wilayaId))];
    const communeIds = [...new Set(rows.map((row) => row.communeId).filter((id): id is string => id != null))];

    const [wilayas, communes] = await Promise.all([
      this.prisma.wilaya.findMany({ where: { id: { in: wilayaIds } } }),
      this.prisma.commune.findMany({ where: { id: { in: communeIds } } }),
    ]);
    const wilayaById = new Map(wilayas.map((wilaya) => [wilaya.id, wilaya]));
    const communeById = new Map(communes.map((commune) => [commune.id, commune]));

    for (const row of rows) {
      if (!wilayaById.has(row.wilayaId)) {
        throw new BadRequestError(`Unknown wilayaId: ${row.wilayaId}`);
      }
      if (row.communeId != null) {
        const commune = communeById.get(row.communeId);
        if (!commune) throw new BadRequestError(`Unknown communeId: ${row.communeId}`);
        if (commune.wilayaId !== row.wilayaId) {
          throw new BadRequestError(`Commune ${row.communeId} does not belong to wilaya ${row.wilayaId}`);
        }
      }
    }
  }
}

// Injected into every document module (orders, sales, purchasing, repairs, billing).
export class SequenceService implements ISequenceService {
  constructor(private prisma: PrismaClient) {}

  async nextNumber(tx: Prisma.TransactionClient, docType: DocType): Promise<string> {
    const rows = await tx.$queryRaw<
      { value: string }[]
    >`SELECT value FROM "Setting" WHERE key = 'invoicing' FOR UPDATE`;
    const row = rows[0];
    if (!row) throw new Error('Settings row "invoicing" is missing — seed the database before allocating sequences');

    const invoicing = JSON.parse(row.value) as SettingsDto['invoicing'];
    const prefix = invoicing.prefixes[docType];
    const n = invoicing.nextSequences[docType] ?? 1;
    const year = new Date().getFullYear();
    const formatted = `${prefix}-${year}-${String(n).padStart(4, '0')}`;

    invoicing.nextSequences[docType] = n + 1;
    await tx.$executeRaw`UPDATE "Setting" SET value = ${JSON.stringify(invoicing)} WHERE key = 'invoicing'`;

    return formatted;
  }
}

// Injected into orders. PICKUP callers never call this (fee 0 by rule — spec).
export class DeliveryFeeService implements IDeliveryFeeService {
  constructor(private prisma: PrismaClient) {}

  async resolve(wilayaId: string, communeId: string | null, mode: 'home' | 'office'): Promise<number> {
    const resolved = await resolveFeeAndSource(this.prisma, wilayaId, communeId);
    return mode === 'home' ? resolved.deliveryHome : resolved.deliveryOffice;
  }
}

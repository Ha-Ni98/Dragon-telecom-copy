import ExcelJS from 'exceljs';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  EXPORT_ERROR,
  EXPORT_MAX_ROWS,
  FeeSource,
  HERO_SLIDE_ERROR,
  HERO_SLIDES_MAX,
  HERO_SLIDES_PUBLIC_MAX,
  SettingsResponseSchema,
  storeDayRangeUtc,
  type AdminFeesDto,
  type DocType,
  type FeeDto,
  type FeeQuery,
  type CreateHeroSlideCommand,
  type FeesExportQuery,
  type HeroSlideDto,
  type MediaImageDto,
  type PublicHeroSlideDto,
  type PublicSettingsDto,
  type ReorderHeroSlidesCommand,
  type SettingsDto,
  type UpdateHeroSlideCommand,
  type UpdateSettingsCommand,
  type UploadImageCommand,
  type UpsertFeesCommand,
  type WilayaDto,
} from '@dragon-telecom/contract';
import { BadRequestError, ConflictError, NotFoundError } from '@common/errors';
import { eventBus } from '@common/events/event-bus';
import { csvMoney, toCsv, CSV_MIME } from '@common/utils/csv.utils';
import { renderTablePdf } from '@common/utils/pdf.utils';
import { imagePipeline } from '@common/media/image-pipeline.service';
import { storageService } from '@common/storage/storage.service';
import type { UploadFile } from '@common/storage/storage.types';
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
// S38: `null` is also admitted — it means "clear this field" (see mergeDefined).
type OptionalPatch<T> = { [K in keyof T]?: T[K] | null | undefined };

// Field-by-field merge (only overwrites patch keys that are actually present and non-undefined)
// — a plain `{...base, ...patch}` spread type-widens every field to `T[K] | undefined` under
// exactOptionalPropertyTypes, even though every `UpdateSettingsCommand` leaf is independently
// optional/omitted-when-absent at runtime. This keeps the merge both runtime-correct and typed
// as plain `T`.
// S38 — a patch leaf of `null` REMOVES that key from the section: optional DTO fields cannot
// otherwise be cleared, because `undefined` means "leave untouched". Existing commands never send
// `null` (their schemas reject it), so older sections behave exactly as before.
function mergeDefined<T extends object>(base: T, patch: OptionalPatch<T> | undefined): T {
  if (!patch) return base;
  const result = { ...base };
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const value = patch[key];
    if (value === null) delete result[key];
    else if (value !== undefined) result[key] = value as T[keyof T];
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
      // S25 — routed through the shared RFC 4180 writer (BOM + CRLF + proper quoting) instead of
      // a bare join(','); a wilaya/commune *code* never contains a comma today, but the writer
      // costs nothing and keeps every CSV export in the app on one code path.
      return {
        filename: 'delivery-fees.csv',
        mime: CSV_MIME,
        body: toCsv(
          [...FEE_ROW_HEADERS],
          rows.map((row) => [row.wilayaCode, row.communeCode ?? '', csvMoney(row.deliveryHome), csvMoney(row.deliveryOffice)]),
        ),
      };
    }

    if (format === 'pdf') {
      // S25 — every export in this module is a single in-memory document, so an unbounded result
      // set would hold the request open while it serialised. 58 wilayas plus overrides will never
      // approach EXPORT_MAX_ROWS, but the guard is applied uniformly across every export.
      if (rows.length > EXPORT_MAX_ROWS) {
        throw new BadRequestError(EXPORT_ERROR.ROW_LIMIT_EXCEEDED, { limit: EXPORT_MAX_ROWS, total: rows.length });
      }
      // The CSV/Excel branches above export wilaya/commune *codes* because they round-trip
      // through the importer (importFees). The PDF is read by a human, so it shows the resolved
      // French names instead — do not "fix" this back to codes to match the other two branches.
      const body = await renderTablePdf({
        title: 'Delivery fees',
        filters: [],
        generatedAt: new Date(),
        orientation: 'portrait',
        columns: [
          { header: 'Wilaya', width: 3 },
          { header: 'Commune', width: 3 },
          { header: 'Home delivery', width: 2, align: 'right' },
          { header: 'Office delivery', width: 2, align: 'right' },
        ],
        rows: fees.map((fee) => [
          fee.wilaya.frName,
          fee.commune?.frName ?? '—',
          fee.deliveryHome.toNumber().toFixed(2),
          fee.deliveryOffice.toNumber().toFixed(2),
        ]),
      });
      return { filename: 'delivery-fees.pdf', mime: 'application/pdf', body };
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

  // S26.1 — a thin delegation to the shared pipeline. No settings row is touched here: the
  // caller decides what the returned URL becomes (a brand logo, a family icon, the store logo,
  // the print logo) with its own PATCH.
  async uploadImage(file: UploadFile, cmd: UploadImageCommand): Promise<MediaImageDto> {
    return imagePipeline.process(file, cmd.purpose);
  }

  // --- S38 hero slides ---

  // S38 — every key the hero accepts is one the shared pipeline wrote into the hero folder:
  // content-addressed `hero/<sha256>.webp` (image-pipeline.service.ts). Checked BEFORE any write,
  // so a crafted key can neither be stored nor later fed to storage.delete (a client-sent
  // `products/<hash>.webp` must never become deletable through a slide).
  private static readonly HERO_KEY_PATTERN = /^hero\/[0-9a-f]{64}\.webp$/;

  private async assertHeroImageKey(key: string): Promise<void> {
    if (!PlatformService.HERO_KEY_PATTERN.test(key) || !(await storageService.exists(key))) {
      throw new BadRequestError(HERO_SLIDE_ERROR.INVALID_IMAGE);
    }
  }

  // P2 — the schedule is store days (Africa/Algiers, endsOn inclusive), converted with the same
  // helper every S34 date filter uses: startsAt = that day's local midnight, endsAt = the
  // midnight AFTER endsOn (exclusive).
  private static heroWindow(startsOn: string | null | undefined, endsOn: string | null | undefined) {
    const range = storeDayRangeUtc(startsOn ?? undefined, endsOn ?? undefined);
    return { startsAt: range.gte ?? null, endsAt: range.lt ?? null };
  }

  private async listHeroSlideRows() {
    return this.prisma.heroSlide.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      take: HERO_SLIDES_MAX,
    });
  }

  async listAdminHeroSlides(): Promise<HeroSlideDto[]> {
    const now = new Date();
    return (await this.listHeroSlideRows()).map((slide) => PlatformMapper.toHeroSlideDto(slide, now));
  }

  // Active, inside its window, by displayOrder, bounded at HERO_SLIDES_PUBLIC_MAX (P5).
  async listPublicHeroSlides(): Promise<PublicHeroSlideDto[]> {
    const now = new Date();
    const rows = await this.prisma.heroSlide.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      take: HERO_SLIDES_PUBLIC_MAX,
    });
    return rows.map((slide) => PlatformMapper.toPublicHeroSlideDto(slide));
  }

  async createHeroSlide(cmd: CreateHeroSlideCommand): Promise<HeroSlideDto[]> {
    const existing = await this.prisma.heroSlide.aggregate({
      _count: { _all: true },
      _max: { displayOrder: true },
    });
    if (existing._count._all >= HERO_SLIDES_MAX) {
      throw new ConflictError(HERO_SLIDE_ERROR.LIMIT_REACHED);
    }
    await this.assertHeroImageKey(cmd.desktopImageKey);
    await this.assertHeroImageKey(cmd.mobileImageKey);

    await this.prisma.heroSlide.create({
      data: {
        desktopImageKey: cmd.desktopImageKey,
        desktopImageUrl: storageService.urlFor(cmd.desktopImageKey),
        mobileImageKey: cmd.mobileImageKey,
        mobileImageUrl: storageService.urlFor(cmd.mobileImageKey),
        text: cmd.text as Prisma.InputJsonValue,
        link: cmd.link,
        isActive: cmd.isActive ?? true,
        displayOrder: (existing._max.displayOrder ?? -1) + 1,
        ...PlatformService.heroWindow(cmd.startsOn, cmd.endsOn),
      },
    });

    eventBus.emit('heroSlides.changed', {
      description: `Hero slide created: "${cmd.text.fr.title}" → ${cmd.link}`,
    });
    return this.listAdminHeroSlides();
  }

  async updateHeroSlide(id: string, cmd: UpdateHeroSlideCommand): Promise<HeroSlideDto[]> {
    const slide = await this.prisma.heroSlide.findUnique({ where: { id } });
    if (!slide) throw new NotFoundError('HeroSlide');

    if (cmd.desktopImageKey !== undefined) await this.assertHeroImageKey(cmd.desktopImageKey);
    if (cmd.mobileImageKey !== undefined) await this.assertHeroImageKey(cmd.mobileImageKey);

    // The contract only checks endsOn >= startsOn when BOTH are sent; with one bound sent it is
    // compared against the stored other bound, in store days.
    const current = PlatformMapper.toHeroSlideDto(slide, new Date());
    const startsOn = cmd.startsOn === undefined ? current.startsOn : (cmd.startsOn ?? undefined);
    const endsOn = cmd.endsOn === undefined ? current.endsOn : (cmd.endsOn ?? undefined);
    if (startsOn !== undefined && endsOn !== undefined && endsOn < startsOn) {
      throw new BadRequestError('endsOn must not be before startsOn');
    }

    await this.prisma.heroSlide.update({
      where: { id },
      data: {
        ...(cmd.desktopImageKey !== undefined
          ? { desktopImageKey: cmd.desktopImageKey, desktopImageUrl: storageService.urlFor(cmd.desktopImageKey) }
          : {}),
        ...(cmd.mobileImageKey !== undefined
          ? { mobileImageKey: cmd.mobileImageKey, mobileImageUrl: storageService.urlFor(cmd.mobileImageKey) }
          : {}),
        ...(cmd.text !== undefined ? { text: cmd.text as Prisma.InputJsonValue } : {}),
        ...(cmd.link !== undefined ? { link: cmd.link } : {}),
        ...(cmd.isActive !== undefined ? { isActive: cmd.isActive } : {}),
        // null clears a bound, an absent field leaves its column alone.
        ...(cmd.startsOn !== undefined ? { startsAt: PlatformService.heroWindow(cmd.startsOn, null).startsAt } : {}),
        ...(cmd.endsOn !== undefined ? { endsAt: PlatformService.heroWindow(null, cmd.endsOn).endsAt } : {}),
      },
    });

    // Storage delete only AFTER the row points elsewhere, so a failed delete leaves an orphan
    // object, never a slide pointing at a missing one.
    if (cmd.desktopImageKey !== undefined && cmd.desktopImageKey !== slide.desktopImageKey) {
      await this.releaseHeroImage(slide.desktopImageKey);
    }
    if (cmd.mobileImageKey !== undefined && cmd.mobileImageKey !== slide.mobileImageKey) {
      await this.releaseHeroImage(slide.mobileImageKey);
    }

    const changed = (Object.keys(cmd) as (keyof UpdateHeroSlideCommand)[]).join(', ');
    eventBus.emit('heroSlides.changed', {
      description: `Hero slide updated: "${current.text.fr.title}" (${changed})`,
    });
    return this.listAdminHeroSlides();
  }

  async deleteHeroSlide(id: string): Promise<HeroSlideDto[]> {
    const slide = await this.prisma.heroSlide.findUnique({ where: { id } });
    if (!slide) throw new NotFoundError('HeroSlide');

    await this.prisma.heroSlide.delete({ where: { id } });
    await this.releaseHeroImage(slide.desktopImageKey);
    await this.releaseHeroImage(slide.mobileImageKey);

    const title = PlatformMapper.toHeroSlideDto(slide, new Date()).text.fr.title;
    eventBus.emit('heroSlides.changed', { description: `Hero slide deleted: "${title}"` });
    return this.listAdminHeroSlides();
  }

  // P9 — the list must name every slide exactly once, or the request is stale (a slide was added
  // or removed in another tab): 409 rather than silently dropping or resurrecting a slide.
  async reorderHeroSlides(cmd: ReorderHeroSlidesCommand): Promise<HeroSlideDto[]> {
    const rows = await this.prisma.heroSlide.findMany({ select: { id: true } });
    const known = new Set(rows.map((row) => row.id));
    const requested = new Set(cmd.ids);
    if (requested.size !== cmd.ids.length || requested.size !== known.size || cmd.ids.some((id) => !known.has(id))) {
      throw new ConflictError(HERO_SLIDE_ERROR.ORDER_MISMATCH);
    }

    await this.prisma.$transaction(
      cmd.ids.map((id, index) =>
        this.prisma.heroSlide.update({ where: { id }, data: { displayOrder: index } }),
      ),
    );

    eventBus.emit('heroSlides.changed', { description: `Hero slides reordered (${cmd.ids.length} slides)` });
    return this.listAdminHeroSlides();
  }

  // P10 — content-addressed keys can be shared by two slides (the same file uploaded twice), so
  // an object is deleted only once no slide references it in either column. Mirrors
  // catalog.service.ts#deleteImage. The pipeline also wrote a `-thumb` derivative — remove it too.
  private async releaseHeroImage(key: string): Promise<void> {
    const stillUsed = await this.prisma.heroSlide.count({
      where: { OR: [{ desktopImageKey: key }, { mobileImageKey: key }] },
    });
    if (stillUsed > 0) return;
    await storageService.deleteMany([key, key.replace(/\.webp$/, '-thumb.webp')]);
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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { DocType, ErrorCode, FeeSource } from '@dragon-telecom/contract';
import { AppError } from '../../../../src/common/errors';
import { PlatformService, SequenceService, DeliveryFeeService } from '../../../../src/modules/platform/platform.service';
import { DEFAULT_SETTINGS } from '../../../../prisma/settings-defaults';
import { validFeesWorkbook, mixedFeesWorkbook } from '../../../data/fees-import.fixture';

const {
  wilayaFindManyMock,
  communeFindManyMock,
  deliveryFeeFindUniqueMock,
  deliveryFeeFindFirstMock,
  deliveryFeeFindManyMock,
  deliveryFeeCreateMock,
  deliveryFeeUpdateMock,
  deliveryFeeUpsertMock,
  settingFindManyMock,
  settingFindUniqueMock,
  settingUpsertMock,
  transactionMock,
  eventBusEmitMock,
} = vi.hoisted(() => ({
  wilayaFindManyMock: vi.fn(),
  communeFindManyMock: vi.fn(),
  deliveryFeeFindUniqueMock: vi.fn(),
  deliveryFeeFindFirstMock: vi.fn(),
  deliveryFeeFindManyMock: vi.fn(),
  deliveryFeeCreateMock: vi.fn(),
  deliveryFeeUpdateMock: vi.fn(),
  deliveryFeeUpsertMock: vi.fn(),
  settingFindManyMock: vi.fn(),
  settingFindUniqueMock: vi.fn(),
  settingUpsertMock: vi.fn(),
  transactionMock: vi.fn(),
  eventBusEmitMock: vi.fn(),
}));

vi.mock('@common/events/event-bus', () => ({ eventBus: { emit: eventBusEmitMock } }));

const prismaMock = {
  wilaya: { findMany: wilayaFindManyMock },
  commune: { findMany: communeFindManyMock },
  deliveryFee: {
    findUnique: deliveryFeeFindUniqueMock,
    findFirst: deliveryFeeFindFirstMock,
    findMany: deliveryFeeFindManyMock,
    create: deliveryFeeCreateMock,
    update: deliveryFeeUpdateMock,
    upsert: deliveryFeeUpsertMock,
  },
  setting: {
    findMany: settingFindManyMock,
    findUnique: settingFindUniqueMock,
    upsert: settingUpsertMock,
  },
  $transaction: transactionMock,
};

const WILAYA_ID = '11111111-1111-4111-8111-111111111111';
const COMMUNE_ID = '22222222-2222-4222-8222-222222222222';

const buildWilaya = (overrides: Record<string, unknown> = {}) => ({
  id: WILAYA_ID,
  wilayaCode: '30',
  frName: 'Ouargla',
  arName: 'ورقلة',
  communes: [],
  ...overrides,
});

const seededSettingRows = () => Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value: JSON.stringify(value) }));

const expectRejection = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
    throw new Error('Expected the promise to reject');
  } catch (err) {
    return err as AppError;
  }
};

describe('PlatformService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
  });

  const service = () => new PlatformService(prismaMock as never);

  describe('listWilayas', () => {
    it('returns mapped wilayas ordered by code with nested communes', async () => {
      wilayaFindManyMock.mockResolvedValueOnce([
        buildWilaya({ communes: [{ id: COMMUNE_ID, communeCode: '1101', frName: 'Ouargla', arName: 'ورقلة' }] }),
      ]);

      const dtos = await service().listWilayas();

      expect(wilayaFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { wilayaCode: 'asc' },
          include: { communes: { orderBy: { communeCode: 'asc' } } },
        }),
      );
      expect(dtos).toHaveLength(1);
      expect(dtos[0]?.communes).toHaveLength(1);
    });
  });

  describe('resolveFee', () => {
    it('prefers the commune-level override', async () => {
      deliveryFeeFindUniqueMock.mockResolvedValueOnce({
        deliveryHome: new Prisma.Decimal('800'),
        deliveryOffice: new Prisma.Decimal('450'),
      });

      const dto = await service().resolveFee({ wilayaId: WILAYA_ID, communeId: COMMUNE_ID });

      expect(dto).toEqual({ deliveryHome: 800, deliveryOffice: 450, source: FeeSource.COMMUNE });
      expect(deliveryFeeFindFirstMock).not.toHaveBeenCalled();
    });

    it('falls back to the wilaya-level row when no commune override exists', async () => {
      deliveryFeeFindUniqueMock.mockResolvedValueOnce(null);
      deliveryFeeFindFirstMock.mockResolvedValueOnce({
        deliveryHome: new Prisma.Decimal('600'),
        deliveryOffice: new Prisma.Decimal('350'),
      });

      const dto = await service().resolveFee({ wilayaId: WILAYA_ID, communeId: COMMUNE_ID });

      expect(dto).toEqual({ deliveryHome: 600, deliveryOffice: 350, source: FeeSource.WILAYA });
    });

    it('falls back to the settings default when no fee row exists at all', async () => {
      deliveryFeeFindUniqueMock.mockResolvedValueOnce(null);
      deliveryFeeFindFirstMock.mockResolvedValueOnce(null);
      settingFindUniqueMock.mockResolvedValueOnce({ key: 'delivery', value: JSON.stringify({ defaultHome: 500, defaultOffice: 300 }) });

      const dto = await service().resolveFee({ wilayaId: WILAYA_ID, communeId: COMMUNE_ID });

      expect(dto).toEqual({ deliveryHome: 500, deliveryOffice: 300, source: FeeSource.DEFAULT });
    });

    it('skips the commune lookup entirely when no communeId is given', async () => {
      deliveryFeeFindFirstMock.mockResolvedValueOnce({
        deliveryHome: new Prisma.Decimal('600'),
        deliveryOffice: new Prisma.Decimal('350'),
      });

      await service().resolveFee({ wilayaId: WILAYA_ID });

      expect(deliveryFeeFindUniqueMock).not.toHaveBeenCalled();
    });
  });

  describe('getAdminFees', () => {
    it('assembles wilaya rows against the resolved settings default', async () => {
      wilayaFindManyMock.mockResolvedValueOnce([buildWilaya()]);
      deliveryFeeFindManyMock.mockResolvedValueOnce([]);
      settingFindManyMock.mockResolvedValueOnce(seededSettingRows());

      const dto = await service().getAdminFees();

      expect(dto.wilayas[0]?.deliveryHome).toBe(DEFAULT_SETTINGS.delivery.defaultHome);
      expect(dto.wilayas[0]?.deliveryOffice).toBe(DEFAULT_SETTINGS.delivery.defaultOffice);
    });
  });

  describe('upsertFees', () => {
    it('rejects an unknown wilayaId without writing anything', async () => {
      wilayaFindManyMock.mockResolvedValueOnce([]);
      communeFindManyMock.mockResolvedValueOnce([]);

      const err = await expectRejection(
        service().upsertFees({ rows: [{ wilayaId: WILAYA_ID, communeId: null, deliveryHome: 500, deliveryOffice: 300 }] }),
      );

      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('rejects a commune that does not belong to the given wilaya', async () => {
      wilayaFindManyMock.mockResolvedValueOnce([buildWilaya()]);
      communeFindManyMock.mockResolvedValueOnce([{ id: COMMUNE_ID, wilayaId: 'some-other-wilaya' }]);

      const err = await expectRejection(
        service().upsertFees({ rows: [{ wilayaId: WILAYA_ID, communeId: COMMUNE_ID, deliveryHome: 500, deliveryOffice: 300 }] }),
      );

      expect(err.statusCode).toBe(400);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('updates the existing wilaya-level row instead of creating a duplicate (NULL-commune workaround)', async () => {
      wilayaFindManyMock.mockResolvedValueOnce([buildWilaya()]);
      communeFindManyMock.mockResolvedValueOnce([]);
      deliveryFeeFindFirstMock.mockResolvedValueOnce({ id: 'existing-fee-id' });
      // re-fetch inside getAdminFees() after the write
      wilayaFindManyMock.mockResolvedValueOnce([buildWilaya()]);
      deliveryFeeFindManyMock.mockResolvedValueOnce([]);
      settingFindManyMock.mockResolvedValueOnce(seededSettingRows());

      await service().upsertFees({ rows: [{ wilayaId: WILAYA_ID, communeId: null, deliveryHome: 700, deliveryOffice: 400 }] });

      expect(deliveryFeeUpdateMock).toHaveBeenCalledWith({
        where: { id: 'existing-fee-id' },
        data: { deliveryHome: 700, deliveryOffice: 400 },
      });
      expect(deliveryFeeCreateMock).not.toHaveBeenCalled();
      expect(eventBusEmitMock).toHaveBeenCalledWith('deliveryFees.changed', expect.objectContaining({ description: expect.any(String) }));
    });

    it('creates a new wilaya-level row when none exists yet', async () => {
      wilayaFindManyMock.mockResolvedValueOnce([buildWilaya()]);
      communeFindManyMock.mockResolvedValueOnce([]);
      deliveryFeeFindFirstMock.mockResolvedValueOnce(null);
      wilayaFindManyMock.mockResolvedValueOnce([buildWilaya()]);
      deliveryFeeFindManyMock.mockResolvedValueOnce([]);
      settingFindManyMock.mockResolvedValueOnce(seededSettingRows());

      await service().upsertFees({ rows: [{ wilayaId: WILAYA_ID, communeId: null, deliveryHome: 700, deliveryOffice: 400 }] });

      expect(deliveryFeeCreateMock).toHaveBeenCalledWith({
        data: { wilayaId: WILAYA_ID, communeId: null, deliveryHome: 700, deliveryOffice: 400 },
      });
    });

    it('upserts a commune-level override via the compound unique key', async () => {
      wilayaFindManyMock.mockResolvedValueOnce([buildWilaya()]);
      communeFindManyMock.mockResolvedValueOnce([{ id: COMMUNE_ID, wilayaId: WILAYA_ID }]);
      wilayaFindManyMock.mockResolvedValueOnce([buildWilaya()]);
      deliveryFeeFindManyMock.mockResolvedValueOnce([]);
      settingFindManyMock.mockResolvedValueOnce(seededSettingRows());

      await service().upsertFees({ rows: [{ wilayaId: WILAYA_ID, communeId: COMMUNE_ID, deliveryHome: 800, deliveryOffice: 450 }] });

      expect(deliveryFeeUpsertMock).toHaveBeenCalledWith({
        where: { wilayaId_communeId: { wilayaId: WILAYA_ID, communeId: COMMUNE_ID } },
        update: { deliveryHome: 800, deliveryOffice: 450 },
        create: { wilayaId: WILAYA_ID, communeId: COMMUNE_ID, deliveryHome: 800, deliveryOffice: 450 },
      });
    });
  });

  describe('importFees', () => {
    it('rejects the whole file when one row is invalid, without writing anything', async () => {
      wilayaFindManyMock.mockResolvedValueOnce([{ id: WILAYA_ID, wilayaCode: '30' }]);
      communeFindManyMock.mockResolvedValueOnce([]);

      const buffer = await mixedFeesWorkbook('30');
      const err = await expectRejection(service().importFees(buffer));

      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect((err.details as { errors: unknown[] }).errors.length).toBeGreaterThan(0);
      expect(transactionMock).not.toHaveBeenCalled();
      expect(deliveryFeeCreateMock).not.toHaveBeenCalled();
      expect(deliveryFeeUpsertMock).not.toHaveBeenCalled();
    });

    it('imports a well-formed file and emits deliveryFees.changed', async () => {
      wilayaFindManyMock.mockResolvedValueOnce([{ id: WILAYA_ID, wilayaCode: '30' }]);
      communeFindManyMock.mockResolvedValueOnce([]);
      deliveryFeeFindFirstMock.mockResolvedValueOnce(null);

      const buffer = await validFeesWorkbook('30', 500, 300);
      const result = await service().importFees(buffer);

      expect(result).toEqual({ imported: 1 });
      expect(deliveryFeeCreateMock).toHaveBeenCalledWith({
        data: { wilayaId: WILAYA_ID, communeId: null, deliveryHome: 500, deliveryOffice: 300 },
      });
      expect(eventBusEmitMock).toHaveBeenCalledWith('deliveryFees.changed', expect.objectContaining({ description: expect.any(String) }));
    });
  });

  describe('exportFees', () => {
    beforeEach(() => {
      deliveryFeeFindManyMock.mockResolvedValueOnce([
        {
          wilaya: { wilayaCode: '30' },
          commune: null,
          deliveryHome: new Prisma.Decimal('500'),
          deliveryOffice: new Prisma.Decimal('300'),
        },
      ]);
    });

    it('defaults to excel and returns a Buffer body', async () => {
      const result = await service().exportFees({});
      expect(result.mime).toContain('spreadsheetml');
      expect(Buffer.isBuffer(result.body)).toBe(true);
    });

    it('returns csv as text containing the wilaya code', async () => {
      const result = await service().exportFees({ format: 'csv' });
      expect(result.mime).toBe('text/csv');
      expect(String(result.body)).toContain('30');
    });

    it('returns json rows', async () => {
      const result = await service().exportFees({ format: 'json' });
      expect(result.mime).toBe('application/json');
      expect(JSON.parse(String(result.body))).toEqual([{ wilayaCode: '30', communeCode: null, deliveryHome: 500, deliveryOffice: 300 }]);
    });
  });

  describe('getSettings / getPublicSettings', () => {
    it('merges stored rows over defaults', async () => {
      settingFindManyMock.mockResolvedValueOnce([{ key: 'store', value: JSON.stringify({ name: 'Custom' }) }]);
      const dto = await service().getSettings();
      expect(dto.store.name).toBe('Custom');
      expect(dto.delivery).toEqual(DEFAULT_SETTINGS.delivery);
    });

    it('getPublicSettings exposes only storefront', async () => {
      settingFindManyMock.mockResolvedValueOnce(seededSettingRows());
      const dto = await service().getPublicSettings();
      expect(Object.keys(dto)).toEqual(['storefront']);
    });
  });

  describe('updateSettings', () => {
    it('rejects a nextSequences decrease with a 409 and writes nothing', async () => {
      settingFindManyMock.mockResolvedValueOnce(seededSettingRows());
      const lowered = { ...DEFAULT_SETTINGS.invoicing.nextSequences, [DocType.SALE]: 0 };

      const err = await expectRejection(
        service().updateSettings({ invoicing: { nextSequences: lowered } }),
      );

      expect(err.statusCode).toBe(409);
      expect(err.code).toBe(ErrorCode.RESOURCE_CONFLICT);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('accepts an equal-or-higher nextSequences and merges the touched section only', async () => {
      settingFindManyMock.mockResolvedValueOnce(seededSettingRows());
      const raised = { ...DEFAULT_SETTINGS.invoicing.nextSequences, [DocType.SALE]: 10 };

      const dto = await service().updateSettings({ invoicing: { nextSequences: raised } });

      expect(dto.invoicing.nextSequences[DocType.SALE]).toBe(10);
      expect(dto.store).toEqual(DEFAULT_SETTINGS.store);
      expect(settingUpsertMock).toHaveBeenCalledTimes(1);
      expect(settingUpsertMock).toHaveBeenCalledWith(expect.objectContaining({ where: { key: 'invoicing' } }));
    });

    it('narrates old -> new values in the emitted description', async () => {
      settingFindManyMock.mockResolvedValueOnce(seededSettingRows());

      await service().updateSettings({ delivery: { defaultHome: 999 } });

      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'settings.changed',
        expect.objectContaining({ description: expect.stringContaining('500') }),
      );
      const [, payload] = eventBusEmitMock.mock.calls[0] as [string, { description: string }];
      expect(payload.description).toContain('999');
    });

    it('is a no-op (no write, no emit) when the command touches nothing', async () => {
      settingFindManyMock.mockResolvedValueOnce(seededSettingRows());

      await service().updateSettings({});

      expect(transactionMock).not.toHaveBeenCalled();
      expect(eventBusEmitMock).not.toHaveBeenCalled();
    });
  });
});

describe('SequenceService', () => {
  const buildTx = (row: { prefixes: Record<string, string>; nextSequences: Record<string, number> }) => {
    // Must re-serialize `row` on every call (not a fixed mockResolvedValue) so the second
    // nextNumber() call observes the mutation the first call's $executeRaw applied.
    const queryRawMock = vi.fn().mockImplementation(() => Promise.resolve([{ value: JSON.stringify(row) }]));
    const executeRawMock = vi.fn().mockImplementation((_strings: TemplateStringsArray, ...values: unknown[]) => {
      const newValue = values.find((v) => typeof v === 'string') as string | undefined;
      if (newValue) Object.assign(row, JSON.parse(newValue));
      return Promise.resolve(1);
    });
    return { $queryRaw: queryRawMock, $executeRaw: executeRawMock } as never;
  };

  it('formats PREFIX-YYYY-NNNN and increments the stored counter', async () => {
    const row = { prefixes: { [DocType.SALE]: 'SAL' }, nextSequences: { [DocType.SALE]: 1 } };
    const tx = buildTx(row);
    const service = new SequenceService(prismaMock as never);

    const first = await service.nextNumber(tx, DocType.SALE);
    const year = new Date().getFullYear();
    expect(first).toBe(`SAL-${year}-0001`);

    const second = await service.nextNumber(tx, DocType.SALE);
    expect(second).toBe(`SAL-${year}-0002`);
  });

  // plan §C-2 — the two new purchasing DocTypes must resolve through the same allocator.
  it('allocates SUPPLIER and SUPPLIER_PAYMENT references using the seeded default prefixes', async () => {
    const row = {
      prefixes: DEFAULT_SETTINGS.invoicing.prefixes,
      nextSequences: { ...DEFAULT_SETTINGS.invoicing.nextSequences },
    };
    const tx = buildTx(row);
    const service = new SequenceService(prismaMock as never);
    const year = new Date().getFullYear();

    expect(await service.nextNumber(tx, DocType.SUPPLIER)).toBe(`FRN-${year}-0001`);
    expect(await service.nextNumber(tx, DocType.SUPPLIER_PAYMENT)).toBe(`PAY-${year}-0001`);
  });
});

describe('DeliveryFeeService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves the requested leg (home/office) through the same precedence as resolveFee', async () => {
    deliveryFeeFindUniqueMock.mockResolvedValueOnce({ deliveryHome: new Prisma.Decimal('800'), deliveryOffice: new Prisma.Decimal('450') });
    const service = new DeliveryFeeService(prismaMock as never);

    const home = await service.resolve(WILAYA_ID, COMMUNE_ID, 'home');
    expect(home).toBe(800);
  });

  it('returns 0-safe office leg from the wilaya-level row when no override exists', async () => {
    deliveryFeeFindUniqueMock.mockResolvedValueOnce(null);
    deliveryFeeFindFirstMock.mockResolvedValueOnce({ deliveryHome: new Prisma.Decimal('600'), deliveryOffice: new Prisma.Decimal('350') });
    const service = new DeliveryFeeService(prismaMock as never);

    const office = await service.resolve(WILAYA_ID, COMMUNE_ID, 'office');
    expect(office).toBe(350);
  });
});

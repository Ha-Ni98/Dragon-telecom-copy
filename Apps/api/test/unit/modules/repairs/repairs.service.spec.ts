import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { RepairStatus, UserType } from '@dragon-telecom/contract';
import type { AppError } from '../../../../src/common/errors';
import { RepairsService } from '../../../../src/modules/repairs/repairs.service';
import type { IInventoryService } from '../../../../src/modules/inventory/inventory.interface';
import { makeRepair } from '../../../data/repair.factory';
import { makeCreateRepairCommand } from '../../../data/create-repair.factory';
import { makeRepairPart } from '../../../data/repair-part.factory';

const {
  repairFindUniqueMock,
  repairFindUniqueOrThrowMock,
  repairFindManyMock,
  repairCreateMock,
  repairUpdateMock,
  repairPartCreateMock,
  repairPartUpdateMock,
  repairPartFindUniqueMock,
  repairPartDeleteMock,
  repairPartFindManyMock,
  repairStatusHistoryCreateMock,
  posClientFindUniqueMock,
  productFindUniqueMock,
  userUpsertMock,
  staffFindUniqueMock,
  stockMovementFindFirstMock,
  stockMovementConsumptionFindManyMock,
  transactionMock,
  eventBusEmitMock,
} = vi.hoisted(() => ({
  repairFindUniqueMock: vi.fn(),
  repairFindUniqueOrThrowMock: vi.fn(),
  repairFindManyMock: vi.fn(),
  repairCreateMock: vi.fn(),
  repairUpdateMock: vi.fn(),
  repairPartCreateMock: vi.fn(),
  repairPartUpdateMock: vi.fn(),
  repairPartFindUniqueMock: vi.fn(),
  repairPartDeleteMock: vi.fn(),
  repairPartFindManyMock: vi.fn(),
  repairStatusHistoryCreateMock: vi.fn(),
  posClientFindUniqueMock: vi.fn(),
  productFindUniqueMock: vi.fn(),
  userUpsertMock: vi.fn(),
  staffFindUniqueMock: vi.fn(),
  stockMovementFindFirstMock: vi.fn(),
  stockMovementConsumptionFindManyMock: vi.fn(),
  transactionMock: vi.fn(),
  eventBusEmitMock: vi.fn(),
}));

vi.mock('@common/events/event-bus', () => ({ eventBus: { emit: eventBusEmitMock } }));

const prismaMock = {
  repair: {
    findUnique: repairFindUniqueMock,
    findUniqueOrThrow: repairFindUniqueOrThrowMock,
    findMany: repairFindManyMock,
    create: repairCreateMock,
    update: repairUpdateMock,
  },
  repairPart: {
    create: repairPartCreateMock,
    update: repairPartUpdateMock,
    findUnique: repairPartFindUniqueMock,
    delete: repairPartDeleteMock,
    findMany: repairPartFindManyMock,
  },
  repairStatusHistory: { create: repairStatusHistoryCreateMock },
  posClient: { findUnique: posClientFindUniqueMock },
  product: { findUnique: productFindUniqueMock },
  user: { upsert: userUpsertMock },
  staff: { findUnique: staffFindUniqueMock },
  stockMovement: { findFirst: stockMovementFindFirstMock },
  stockMovementConsumption: { findMany: stockMovementConsumptionFindManyMock },
  $transaction: transactionMock,
};

const REPAIR_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const SYSTEM_STAFF_ID = '44444444-4444-4444-8444-444444444444';
const TECHNICIAN_ID = '55555555-5555-4555-8555-555555555555';
const PART_ID = '66666666-6666-4666-8666-666666666666';

const buildPartRow = (overrides: Record<string, unknown> = {}) => ({
  id: PART_ID,
  repairId: REPAIR_ID,
  productId: PRODUCT_ID,
  productNameSnapshot: 'Screen',
  quantity: 1,
  unitPrice: new Prisma.Decimal(500),
  costOfGoods: null,
  profit: null,
  lineTotal: new Prisma.Decimal(500),
  serialNumbers: null,
  ...overrides,
});

describe('RepairsService', () => {
  const inventoryMock: IInventoryService = {
    reserve: vi.fn(),
    release: vi.fn(),
    addLayer: vi.fn(),
    consumeFifo: vi.fn(),
    returnIn: vi.fn(),
    flushEvents: vi.fn(),
  };
  const sequenceMock = { nextNumber: vi.fn() };

  const staffActor = { sub: STAFF_ID, type: UserType.STAFF, staffId: STAFF_ID };
  const adminActor = { sub: 'admin-1', type: UserType.ADMIN }; // no staffId — no Staff row for admins

  beforeEach(() => {
    vi.resetAllMocks();
    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
    userUpsertMock.mockResolvedValue({ staff: { id: SYSTEM_STAFF_ID } });
    staffFindUniqueMock.mockResolvedValue({ id: SYSTEM_STAFF_ID });
  });

  const service = () => new RepairsService(prismaMock as never, inventoryMock, sequenceMock as never);

  const expectRejection = async (promise: Promise<unknown>): Promise<AppError> => {
    try {
      await promise;
    } catch (err) {
      return err as AppError;
    }
    throw new Error('Expected promise to reject');
  };

  describe('createRepair', () => {
    it('writes the INTAKE→INTAKE history row anchoring created-by-me scoping', async () => {
      sequenceMock.nextNumber.mockResolvedValueOnce('REP-2026-0001');
      repairCreateMock.mockResolvedValueOnce({ id: REPAIR_ID });
      repairFindUniqueOrThrowMock.mockResolvedValueOnce(makeRepair());

      await service().createRepair(makeCreateRepairCommand(), staffActor);

      expect(repairStatusHistoryCreateMock).toHaveBeenCalledWith({
        data: { repairId: REPAIR_ID, fromStatus: 'INTAKE', toStatus: 'INTAKE', note: 'intake', staffId: STAFF_ID },
      });
    });

    it('prefills customerName/customerPhone from the attached PosClient', async () => {
      posClientFindUniqueMock.mockResolvedValueOnce({ name: 'Karim Store', phone: '0555111111' });
      sequenceMock.nextNumber.mockResolvedValueOnce('REP-2026-0001');
      repairCreateMock.mockResolvedValueOnce({ id: REPAIR_ID });
      repairFindUniqueOrThrowMock.mockResolvedValueOnce(makeRepair());

      await service().createRepair(
        makeCreateRepairCommand({ posClientId: '77777777-7777-4777-8777-777777777777', customerName: 'Ignored', customerPhone: '0000000000' }),
        staffActor,
      );

      const createArgs = repairCreateMock.mock.calls[0]?.[0];
      expect(createArgs.data.customerName).toBe('Karim Store');
      expect(createArgs.data.customerPhone).toBe('0555111111');
    });

    it('falls back to the system staff for an admin actor', async () => {
      sequenceMock.nextNumber.mockResolvedValueOnce('REP-2026-0001');
      repairCreateMock.mockResolvedValueOnce({ id: REPAIR_ID });
      repairFindUniqueOrThrowMock.mockResolvedValueOnce(makeRepair());

      await service().createRepair(makeCreateRepairCommand(), adminActor);

      expect(repairStatusHistoryCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ staffId: SYSTEM_STAFF_ID }) }),
      );
    });
  });

  describe('addPart / removePart', () => {
    it('reserves stock and recomputes partsTotal/totalAmount = labour + parts', async () => {
      repairFindUniqueMock.mockResolvedValueOnce({ id: REPAIR_ID, labourPrice: new Prisma.Decimal(200) });
      productFindUniqueMock.mockResolvedValueOnce({ name: 'Screen' });
      repairPartFindManyMock.mockResolvedValueOnce([{ lineTotal: new Prisma.Decimal(500) }]);
      repairFindUniqueOrThrowMock.mockResolvedValueOnce(makeRepair());

      await service().addPart(REPAIR_ID, makeRepairPart({ productId: PRODUCT_ID, quantity: 1, unitPrice: 500 }), staffActor);

      expect(inventoryMock.reserve).toHaveBeenCalledWith(
        prismaMock,
        PRODUCT_ID,
        1,
        expect.objectContaining({ referenceType: 'REPAIR', referenceId: REPAIR_ID, staffId: STAFF_ID }),
      );
      const updateArgs = repairUpdateMock.mock.calls[0]?.[0];
      expect(updateArgs.data.partsTotal).toBe(500);
      expect(updateArgs.data.totalAmount).toBe(700); // 200 labour + 500 parts
      expect(inventoryMock.flushEvents).toHaveBeenCalledTimes(1);
    });

    it('a shortfall during reserve propagates and rolls back (no part row, no total update)', async () => {
      repairFindUniqueMock.mockResolvedValueOnce({ id: REPAIR_ID, labourPrice: new Prisma.Decimal(0) });
      productFindUniqueMock.mockResolvedValueOnce({ name: 'Screen' });
      const conflict = Object.assign(new Error('INSUFFICIENT_STOCK'), { statusCode: 409 });
      (inventoryMock.reserve as ReturnType<typeof vi.fn>).mockRejectedValueOnce(conflict);

      await expect(service().addPart(REPAIR_ID, makeRepairPart(), staffActor)).rejects.toMatchObject({ statusCode: 409 });

      expect(repairPartCreateMock).not.toHaveBeenCalled();
      expect(repairUpdateMock).not.toHaveBeenCalled();
    });

    it('removePart releases stock and recomputes totals from the remaining parts', async () => {
      repairFindUniqueMock.mockResolvedValueOnce({ id: REPAIR_ID, labourPrice: new Prisma.Decimal(100) });
      repairPartFindUniqueMock.mockResolvedValueOnce(buildPartRow());
      repairPartFindManyMock.mockResolvedValueOnce([]);
      repairFindUniqueOrThrowMock.mockResolvedValueOnce(makeRepair());

      await service().removePart(REPAIR_ID, PART_ID, staffActor);

      expect(inventoryMock.release).toHaveBeenCalledWith(
        prismaMock,
        PRODUCT_ID,
        1,
        expect.objectContaining({ referenceType: 'REPAIR', referenceId: REPAIR_ID }),
      );
      const updateArgs = repairUpdateMock.mock.calls[0]?.[0];
      expect(updateArgs.data.partsTotal).toBe(0);
      expect(updateArgs.data.totalAmount).toBe(100); // labour only, no parts left
    });
  });

  describe('changeStatus', () => {
    it('rejects INTAKE→PROCESSING when no technicianId is assigned yet', async () => {
      repairFindUniqueMock.mockResolvedValueOnce(makeRepair({ status: RepairStatus.INTAKE, technicianId: null }));

      const err = await expectRejection(service().changeStatus(REPAIR_ID, { toStatus: RepairStatus.PROCESSING }, staffActor));
      expect(err.statusCode).toBe(400);
    });

    it('allows INTAKE→PROCESSING once a technician is assigned', async () => {
      repairFindUniqueMock.mockResolvedValueOnce(makeRepair({ status: RepairStatus.INTAKE, technicianId: TECHNICIAN_ID }));
      repairFindUniqueOrThrowMock.mockResolvedValueOnce(makeRepair({ status: RepairStatus.PROCESSING }));

      const dto = await service().changeStatus(REPAIR_ID, { toStatus: RepairStatus.PROCESSING }, staffActor);
      expect(dto.status).toBe(RepairStatus.PROCESSING);
      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'repair.statusChanged',
        expect.objectContaining({ fromStatus: RepairStatus.INTAKE, toStatus: RepairStatus.PROCESSING }),
      );
    });

    it('PROCESSING→COMPLETED consumes each part via FIFO exactly once, then a second COMPLETE call is a no-op', async () => {
      const repairRow = makeRepair({ status: RepairStatus.PROCESSING, technicianId: TECHNICIAN_ID, parts: [buildPartRow()] });
      repairFindUniqueMock.mockResolvedValueOnce(repairRow);
      (inventoryMock.consumeFifo as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        movementId: 'm1',
        costOfGoods: 200,
        profit: 300,
        consumptions: [],
      });
      repairFindUniqueOrThrowMock.mockResolvedValueOnce(makeRepair({ status: RepairStatus.COMPLETED }));

      await service().changeStatus(REPAIR_ID, { toStatus: RepairStatus.COMPLETED }, staffActor);

      expect(inventoryMock.consumeFifo).toHaveBeenCalledTimes(1);
      expect(inventoryMock.release).toHaveBeenCalledTimes(1);
      expect(eventBusEmitMock).toHaveBeenCalledTimes(1); // just statusChanged

      // Second call reloads an already-COMPLETED repair -> idempotent short-circuit.
      repairFindUniqueMock.mockResolvedValueOnce(makeRepair({ status: RepairStatus.COMPLETED }));
      await service().changeStatus(REPAIR_ID, { toStatus: RepairStatus.COMPLETED }, staffActor);

      expect(inventoryMock.consumeFifo).toHaveBeenCalledTimes(1);
      expect(eventBusEmitMock).toHaveBeenCalledTimes(1);
    });

    it('COMPLETED→PICKED_UP emits repair.pickedUp exactly once with the costed snapshot', async () => {
      const repairRow = makeRepair({
        status: RepairStatus.COMPLETED,
        totalCost: new Prisma.Decimal(200),
        totalProfit: new Prisma.Decimal(300),
        totalAmount: new Prisma.Decimal(500),
        parts: [buildPartRow({ costOfGoods: new Prisma.Decimal(200), profit: new Prisma.Decimal(300) })],
      });
      repairFindUniqueMock.mockResolvedValueOnce(repairRow);
      repairFindUniqueOrThrowMock.mockResolvedValueOnce(makeRepair({ status: RepairStatus.PICKED_UP }));

      await service().changeStatus(REPAIR_ID, { toStatus: RepairStatus.PICKED_UP, paidAmount: 500 }, staffActor);

      const pickedUpCalls = eventBusEmitMock.mock.calls.filter((call) => call[0] === 'repair.pickedUp');
      expect(pickedUpCalls).toHaveLength(1);
      expect(pickedUpCalls[0]?.[1]).toMatchObject({ repairId: REPAIR_ID, totalCost: 200, totalProfit: 300, paidAmount: 500 });
    });

    it('CANCELLED without consumedPartReturns releases pending parts but leaves already-consumed stock untouched', async () => {
      const repairRow = makeRepair({
        status: RepairStatus.PROCESSING,
        parts: [buildPartRow({ costOfGoods: null }), buildPartRow({ id: '77777777-7777-4777-8777-777777777777', costOfGoods: new Prisma.Decimal(50) })],
      });
      repairFindUniqueMock.mockResolvedValueOnce(repairRow);
      repairFindUniqueOrThrowMock.mockResolvedValueOnce(makeRepair({ status: RepairStatus.CANCELLED }));

      await service().changeStatus(REPAIR_ID, { toStatus: RepairStatus.CANCELLED, note: 'customer withdrew' }, staffActor);

      // Only the still-pending part (costOfGoods null) is released; the consumed one is untouched.
      expect(inventoryMock.release).toHaveBeenCalledTimes(1);
      expect(inventoryMock.returnIn).not.toHaveBeenCalled();
      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'repair.cancelled',
        expect.objectContaining({ repairId: REPAIR_ID, reason: 'customer withdrew' }),
      );
    });

    it('CANCELLED with an explicit consumedPartReturns restock re-enters stock at the consumed cost', async () => {
      const consumedPart = buildPartRow({ costOfGoods: new Prisma.Decimal(50) });
      const repairRow = makeRepair({ status: RepairStatus.COMPLETED, parts: [consumedPart] });
      repairFindUniqueMock.mockResolvedValueOnce(repairRow);
      stockMovementFindFirstMock.mockResolvedValueOnce({ id: 'movement-out-1' });
      stockMovementConsumptionFindManyMock.mockResolvedValueOnce([
        { id: 'c1', inMovementId: 'movement-in-1', quantityConsumed: 1, unitCost: new Prisma.Decimal(50) },
      ]);
      (inventoryMock.returnIn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ movementId: 'movement-return-1' });
      repairFindUniqueOrThrowMock.mockResolvedValueOnce(makeRepair({ status: RepairStatus.CANCELLED }));

      await service().changeStatus(
        REPAIR_ID,
        { toStatus: RepairStatus.CANCELLED, consumedPartReturns: [{ partId: PART_ID, restock: true }] },
        staffActor,
      );

      expect(inventoryMock.returnIn).toHaveBeenCalledWith(
        prismaMock,
        [{ inMovementId: 'movement-in-1', qty: 1, unitCost: 50 }],
        1,
        expect.objectContaining({ referenceType: 'RETURN', referenceId: REPAIR_ID }),
      );
    });

    it('rejects cancelling an already-PICKED_UP repair', async () => {
      repairFindUniqueMock.mockResolvedValueOnce(makeRepair({ status: RepairStatus.PICKED_UP }));

      const err = await expectRejection(service().changeStatus(REPAIR_ID, { toStatus: RepairStatus.CANCELLED }, staffActor));
      expect(err.statusCode).toBe(409);
    });
  });

  describe('getRepair (set-03 B1)', () => {
    it('404s when the repair does not exist', async () => {
      repairFindUniqueMock.mockResolvedValueOnce(null);

      const err = await expectRejection(service().getRepair(REPAIR_ID, staffActor));
      expect(err.statusCode).toBe(404);
    });

    it('returns the ticket for staff, unrestricted by creator', async () => {
      const repair = makeRepair({ id: REPAIR_ID });
      repairFindUniqueMock.mockResolvedValueOnce(repair);
      repairFindUniqueOrThrowMock.mockResolvedValueOnce(repair);

      const dto = await service().getRepair(REPAIR_ID, staffActor);

      expect(dto.id).toBe(REPAIR_ID);
      expect(repairFindUniqueMock).toHaveBeenCalledWith({ where: { id: REPAIR_ID } });
    });

    it('includeMargins is true for admin, false for staff', async () => {
      const repair = makeRepair({ id: REPAIR_ID, totalCost: new Prisma.Decimal(100) });
      repairFindUniqueMock.mockResolvedValue(repair);
      repairFindUniqueOrThrowMock.mockResolvedValue(repair);

      const staffDto = await service().getRepair(REPAIR_ID, staffActor);
      const adminDto = await service().getRepair(REPAIR_ID, adminActor);

      expect(staffDto).not.toHaveProperty('totalCost');
      expect(adminDto).toHaveProperty('totalCost');
    });
  });

  describe('listRepairs', () => {
    it('scopes staff to created-by-me via the intake history marker', async () => {
      repairFindManyMock.mockResolvedValueOnce([]);

      await service().listRepairs({}, staffActor);

      const whereArg = repairFindManyMock.mock.calls[0]?.[0].where;
      expect(whereArg.history.some).toEqual({ fromStatus: 'INTAKE', toStatus: 'INTAKE', staffId: STAFF_ID });
    });

    it('admin sees all repairs, unscoped', async () => {
      repairFindManyMock.mockResolvedValueOnce([]);

      await service().listRepairs({}, adminActor);

      const whereArg = repairFindManyMock.mock.calls[0]?.[0].where;
      expect(whereArg).not.toHaveProperty('history');
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Prisma } from '@prisma/client';
import type { Product, StockMovement } from '@prisma/client';
import { AdjustmentReason, MovementType, ReservationHolderType } from '@dragon-telecom/contract';
import type { StockRowDto } from '@dragon-telecom/contract';
import { InventoryService, InventoryReadService } from '../../../../src/modules/inventory/inventory.service';
import type { ExportResult, MovementRef } from '../../../../src/modules/inventory/inventory.interface';

const { eventBusEmitMock } = vi.hoisted(() => ({ eventBusEmitMock: vi.fn() }));
vi.mock('@common/events/event-bus', () => ({ eventBus: { emit: eventBusEmitMock } }));

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_ID = '22222222-2222-4222-8222-222222222222';
const ORDER_ID = '33333333-3333-4333-8333-333333333333';
const REPAIR_ID = '44444444-4444-4444-8444-444444444444';
const ADJUSTMENT_ID = '55555555-5555-4555-8555-555555555555';
const MOVEMENT_ID = '66666666-6666-4666-8666-666666666666';

const buildRef = (overrides: Partial<MovementRef> = {}): MovementRef => ({
  referenceType: 'ORDER',
  referenceId: ORDER_ID,
  staffId: STAFF_ID,
  ...overrides,
});

const buildProduct = (overrides: Partial<Product> = {}): Product => ({
  id: PRODUCT_ID,
  sku: 'SKU-1',
  barcode: null,
  name: 'Screen Protector',
  description: null,
  familyId: 'family-id',
  brandId: 'brand-id',
  deviceModelId: null,
  guestPrice: null,
  defaultSalePrice: null,
  averageCost: new Prisma.Decimal(0),
  quantityOnHand: 0,
  quantityReserved: 0,
  reorderThreshold: 0,
  isPublished: false,
  isEnabled: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

type FakeMovement = {
  id: string;
  productId: string;
  direction: string;
  type: string;
  quantity: number;
  unitCost: Prisma.Decimal | null;
  remainingQuantity: number | null;
  costOfGoods: Prisma.Decimal | null;
  profit: Prisma.Decimal | null;
  balanceAfter: number;
  referenceType: string;
  referenceId: string;
  reason: string | null;
  staffId: string;
  createdAt: Date;
};

type FakeConsumption = {
  id: string;
  outMovementId: string;
  inMovementId: string;
  quantityConsumed: number;
  unitCost: Prisma.Decimal;
};

// A tiny stateful fake standing in for `Prisma.TransactionClient`. The FIFO engine's own
// correctness (balanceAfter chains, avgCost recompute, layer draining across sequential calls)
// can't be verified by asserting individual mock-call arguments in isolation — each call's
// expected input depends on the previous call's real effect on the row. Mutating plain in-memory
// state mirrors what Postgres would actually do within one transaction (including the
// increment/decrement semantics the engine relies on), without needing a real DB (test:int is
// Sprint 4's job once the module is wired).
const createFakeTx = (initialProduct: Product) => {
  const product: Product = { ...initialProduct };
  const movements: FakeMovement[] = [];
  const consumptions: FakeConsumption[] = [];
  let movementSeq = 0;
  let clock = 0;

  const asDecimal = (v: unknown): Prisma.Decimal =>
    v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v as number);

  const tx = {
    // Real signature is a tagged template: (strings, ...values) — the queried productId is the
    // first interpolated value. Checked against the *current* product so a caller querying some
    // other id correctly gets "not found" (exercised by the "unknown product" test below).
    $queryRaw: vi.fn().mockImplementation(async (_strings: TemplateStringsArray, queriedId: string) =>
      queriedId === product.id ? [{ id: product.id }] : [],
    ),
    product: {
      findUniqueOrThrow: vi.fn().mockImplementation(async () => ({ ...product })),
      update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const target = product as unknown as Record<string, unknown>;
        for (const [key, value] of Object.entries(data)) {
          if (value != null && typeof value === 'object' && 'increment' in (value as object)) {
            const current = (target[key] as number | undefined) ?? 0;
            target[key] = current + (value as { increment: number }).increment;
          } else if (value != null && typeof value === 'object' && 'decrement' in (value as object)) {
            const current = (target[key] as number | undefined) ?? 0;
            target[key] = current - (value as { decrement: number }).decrement;
          } else if (key === 'averageCost') {
            product.averageCost = asDecimal(value);
          } else {
            target[key] = value;
          }
        }
        return { ...product };
      }),
    },
    stockMovement: {
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const movement: FakeMovement = {
          id: `movement-${++movementSeq}`,
          createdAt: new Date(2026, 0, 1, 0, 0, ++clock),
          remainingQuantity: null,
          unitCost: null,
          costOfGoods: null,
          profit: null,
          reason: null,
          ...data,
          ...(data.unitCost != null ? { unitCost: asDecimal(data.unitCost) } : {}),
          ...(data.costOfGoods != null ? { costOfGoods: asDecimal(data.costOfGoods) } : {}),
          ...(data.profit != null ? { profit: asDecimal(data.profit) } : {}),
        } as FakeMovement;
        movements.push(movement);
        return { ...movement };
      }),
      findMany: vi.fn().mockImplementation(
        async ({
          where,
          orderBy,
        }: {
          where: { productId: string; direction: string; remainingQuantity?: { gt: number } };
          orderBy?: { createdAt: 'asc' | 'desc' };
        }) => {
          let rows = movements.filter((m) => m.productId === where.productId && m.direction === where.direction);
          if (where.remainingQuantity?.gt !== undefined) {
            const gt = where.remainingQuantity.gt;
            rows = rows.filter((m) => (m.remainingQuantity ?? 0) > gt);
          }
          if (orderBy?.createdAt === 'asc') rows = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          return rows.map((m) => ({ ...m }));
        },
      ),
      update: vi.fn().mockImplementation(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const movement = movements.find((m) => m.id === where.id);
          if (!movement) throw new Error(`fake tx: movement ${where.id} not found`);
          if (data.remainingQuantity != null && typeof data.remainingQuantity === 'object' && 'decrement' in data.remainingQuantity) {
            movement.remainingQuantity =
              (movement.remainingQuantity ?? 0) - (data.remainingQuantity as { decrement: number }).decrement;
          } else if ('remainingQuantity' in data) {
            movement.remainingQuantity = data.remainingQuantity as number | null;
          }
          return { ...movement };
        },
      ),
      findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
        const movement = movements.find((m) => m.id === where.id);
        return movement ? { ...movement } : null;
      }),
    },
    stockMovementConsumption: {
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `consumption-${consumptions.length + 1}`, ...data } as FakeConsumption;
        consumptions.push(row);
        return { ...row };
      }),
    },
  };

  return {
    tx: tx as unknown as Parameters<InventoryService['addLayer']>[0],
    getProduct: () => ({ ...product }),
    getMovements: () => movements.map((m) => ({ ...m })),
    getConsumptions: () => consumptions.map((c) => ({ ...c })),
  };
};

describe('InventoryService (the FIFO engine)', () => {
  let engine: InventoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new InventoryService({} as never);
  });

  describe('addLayer', () => {
    it('recomputes averageCost as a weighted average and raises quantityOnHand', async () => {
      const { tx, getProduct } = createFakeTx(buildProduct({ quantityOnHand: 10, averageCost: new Prisma.Decimal(100) }));

      await engine.addLayer(tx, PRODUCT_ID, 10, 150, MovementType.SUPPLIER_INVOICE, buildRef());

      const product = getProduct();
      expect(product.quantityOnHand).toBe(20);
      expect(product.averageCost.toNumber()).toBe(125); // (10*100 + 10*150) / 20
    });

    it('writes an IN movement with remainingQuantity = quantity and the resulting balanceAfter', async () => {
      const { tx, getMovements } = createFakeTx(buildProduct({ quantityOnHand: 5 }));

      const result = await engine.addLayer(tx, PRODUCT_ID, 7, 200, MovementType.SUPPLIER_INVOICE, buildRef());

      const [movement] = getMovements();
      if (!movement) throw new Error('expected one movement to have been written');
      expect(movement.id).toBe(result.movementId);
      expect(movement.direction).toBe('IN');
      expect(movement.quantity).toBe(7);
      expect(movement.remainingQuantity).toBe(7);
      expect(movement.balanceAfter).toBe(12);
      expect(movement.staffId).toBe(STAFF_ID);
    });

    it('guards the division when the resulting quantity is 0', async () => {
      const { tx, getProduct } = createFakeTx(buildProduct({ quantityOnHand: 0, averageCost: new Prisma.Decimal(0) }));

      await engine.addLayer(tx, PRODUCT_ID, 0, 100, MovementType.SUPPLIER_INVOICE, buildRef());

      expect(getProduct().averageCost.toNumber()).toBe(0);
    });

    it('buffers stockChanged but not lowStock (available only increases)', async () => {
      const { tx } = createFakeTx(buildProduct({ quantityOnHand: 1, reorderThreshold: 5 }));

      await engine.addLayer(tx, PRODUCT_ID, 10, 100, MovementType.SUPPLIER_INVOICE, buildRef());
      engine.flushEvents(tx);

      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'inventory.stockChanged',
        expect.objectContaining({ productId: PRODUCT_ID, onHand: 11 }),
      );
      expect(eventBusEmitMock).not.toHaveBeenCalledWith('inventory.lowStock', expect.anything());
    });
  });

  describe('consumeFifo — the spec scenario: layers 10@100 + 10@150, consume 15', () => {
    it('drains oldest-first: COGS 1750, leaves layer 5@150, correct consumption rows', async () => {
      const { tx, getProduct, getMovements, getConsumptions } = createFakeTx(buildProduct({ quantityOnHand: 0 }));

      await engine.addLayer(tx, PRODUCT_ID, 10, 100, MovementType.SUPPLIER_INVOICE, buildRef());
      await engine.addLayer(tx, PRODUCT_ID, 10, 150, MovementType.SUPPLIER_INVOICE, buildRef());

      const result = await engine.consumeFifo(tx, PRODUCT_ID, 15, 3000, MovementType.SALE, buildRef());

      expect(result.costOfGoods).toBe(1750); // 10*100 + 5*150
      expect(result.profit).toBe(3000 - 1750);
      expect(result.consumptions).toEqual([
        { inMovementId: 'movement-1', qty: 10, unitCost: 100 },
        { inMovementId: 'movement-2', qty: 5, unitCost: 150 },
      ]);

      const [firstLayer, secondLayer] = getMovements().filter((m) => m.direction === 'IN');
      if (!firstLayer || !secondLayer) throw new Error('expected two IN layers');
      expect(firstLayer.remainingQuantity).toBe(0); // fully drained
      expect(secondLayer.remainingQuantity).toBe(5); // 5@150 remains

      expect(getProduct().quantityOnHand).toBe(5);
      expect(getConsumptions()).toHaveLength(2);
    });

    it('rejects over-consumption with 409 INSUFFICIENT_STOCK and writes zero rows', async () => {
      const { tx, getMovements, getConsumptions, getProduct } = createFakeTx(buildProduct({ quantityOnHand: 0 }));
      await engine.addLayer(tx, PRODUCT_ID, 10, 100, MovementType.SUPPLIER_INVOICE, buildRef());
      const movementsBefore = getMovements().length;

      await expect(engine.consumeFifo(tx, PRODUCT_ID, 15, 1000, MovementType.SALE, buildRef())).rejects.toMatchObject({
        statusCode: 409,
        message: 'INSUFFICIENT_STOCK',
        details: { productId: PRODUCT_ID, requested: 15, available: 10 },
      });

      expect(getMovements()).toHaveLength(movementsBefore); // no OUT row written
      expect(getConsumptions()).toHaveLength(0);
      expect(getProduct().quantityOnHand).toBe(10); // unchanged
    });

    it('accounts for reservations: qty > (onHand - reserved) is rejected even though onHand alone would cover it', async () => {
      const { tx } = createFakeTx(buildProduct({ quantityOnHand: 0, quantityReserved: 4 }));
      await engine.addLayer(tx, PRODUCT_ID, 10, 100, MovementType.SUPPLIER_INVOICE, buildRef());

      await expect(engine.consumeFifo(tx, PRODUCT_ID, 8, 100, MovementType.SALE, buildRef())).rejects.toMatchObject({
        statusCode: 409,
        details: { requested: 8, available: 6 },
      });
    });

    it('sets profit to null for ADJUSTMENT_OUT (revenue is null)', async () => {
      const { tx, getMovements } = createFakeTx(buildProduct({ quantityOnHand: 0 }));
      await engine.addLayer(tx, PRODUCT_ID, 10, 100, MovementType.SUPPLIER_INVOICE, buildRef());

      const result = await engine.consumeFifo(tx, PRODUCT_ID, 4, null, MovementType.ADJUSTMENT_OUT, buildRef());

      expect(result.profit).toBeNull();
      const [outMovement] = getMovements().filter((m) => m.direction === 'OUT');
      if (!outMovement) throw new Error('expected one OUT movement');
      expect(outMovement.profit).toBeNull();
      expect(outMovement.costOfGoods?.toNumber()).toBe(400);
    });

    it('never touches averageCost (avgCost recomputes on IN only)', async () => {
      const { tx, getProduct } = createFakeTx(buildProduct({ quantityOnHand: 0 }));
      await engine.addLayer(tx, PRODUCT_ID, 10, 100, MovementType.SUPPLIER_INVOICE, buildRef());
      const avgBefore = getProduct().averageCost.toNumber();

      await engine.consumeFifo(tx, PRODUCT_ID, 5, 1000, MovementType.SALE, buildRef());

      expect(getProduct().averageCost.toNumber()).toBe(avgBefore);
    });

    it('records a signed negative quantity on the OUT row', async () => {
      const { tx, getMovements } = createFakeTx(buildProduct({ quantityOnHand: 0 }));
      await engine.addLayer(tx, PRODUCT_ID, 10, 100, MovementType.SUPPLIER_INVOICE, buildRef());

      await engine.consumeFifo(tx, PRODUCT_ID, 6, 900, MovementType.SALE, buildRef());

      const [outMovement] = getMovements().filter((m) => m.direction === 'OUT');
      if (!outMovement) throw new Error('expected one OUT movement');
      expect(outMovement.quantity).toBe(-6);
    });

    it('buffers lowStock only on the downward cross, not while it stays low', async () => {
      const { tx } = createFakeTx(buildProduct({ quantityOnHand: 0, reorderThreshold: 5 }));
      await engine.addLayer(tx, PRODUCT_ID, 20, 100, MovementType.SUPPLIER_INVOICE, buildRef());

      // 20 -> 14 available: still above threshold(5), no lowStock.
      await engine.consumeFifo(tx, PRODUCT_ID, 6, 100, MovementType.SALE, buildRef());
      engine.flushEvents(tx);
      expect(eventBusEmitMock).not.toHaveBeenCalledWith('inventory.lowStock', expect.anything());

      // 14 -> 4 available: crosses <=5, emits lowStock once.
      await engine.consumeFifo(tx, PRODUCT_ID, 10, 100, MovementType.SALE, buildRef());
      engine.flushEvents(tx);
      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'inventory.lowStock',
        expect.objectContaining({ productId: PRODUCT_ID, available: 4, threshold: 5 }),
      );
      eventBusEmitMock.mockClear();

      // 4 -> 2 available: already below threshold, must NOT re-emit.
      await engine.consumeFifo(tx, PRODUCT_ID, 2, 100, MovementType.SALE, buildRef());
      engine.flushEvents(tx);
      expect(eventBusEmitMock).not.toHaveBeenCalledWith('inventory.lowStock', expect.anything());
    });
  });

  describe('reserve / release', () => {
    it('reserve raises quantityReserved and leaves onHand untouched', async () => {
      const { tx, getProduct } = createFakeTx(buildProduct({ quantityOnHand: 10, quantityReserved: 0 }));

      await engine.reserve(tx, PRODUCT_ID, 4, buildRef({ referenceType: 'ORDER' }));

      const product = getProduct();
      expect(product.quantityReserved).toBe(4);
      expect(product.quantityOnHand).toBe(10);
    });

    it('release restores available and returns quantityReserved to baseline', async () => {
      const { tx, getProduct } = createFakeTx(buildProduct({ quantityOnHand: 10, quantityReserved: 0 }));

      await engine.reserve(tx, PRODUCT_ID, 4, buildRef({ referenceType: 'ORDER' }));
      await engine.release(tx, PRODUCT_ID, 4, buildRef({ referenceType: 'ORDER' }));

      const product = getProduct();
      expect(product.quantityReserved).toBe(0);
      expect(product.quantityOnHand).toBe(10); // untouched throughout
    });

    it('rejects reserving beyond available stock', async () => {
      const { tx } = createFakeTx(buildProduct({ quantityOnHand: 5, quantityReserved: 2 }));

      await expect(engine.reserve(tx, PRODUCT_ID, 4, buildRef())).rejects.toMatchObject({
        statusCode: 409,
        message: 'INSUFFICIENT_STOCK',
        details: { requested: 4, available: 3 },
      });
    });

    it('derives PENDING_ORDER vs PENDING_REPAIR from ref.referenceType', async () => {
      const { tx: txOrder, getMovements: orderMovements } = createFakeTx(buildProduct({ quantityOnHand: 10 }));
      await engine.reserve(txOrder, PRODUCT_ID, 2, buildRef({ referenceType: 'ORDER' }));
      const [orderMovement] = orderMovements();
      if (!orderMovement) throw new Error('expected one movement');
      expect(orderMovement.type).toBe(MovementType.PENDING_ORDER);

      const { tx: txRepair, getMovements: repairMovements } = createFakeTx(buildProduct({ quantityOnHand: 10 }));
      await engine.reserve(txRepair, PRODUCT_ID, 2, buildRef({ referenceType: 'REPAIR', referenceId: REPAIR_ID }));
      const [repairMovement] = repairMovements();
      if (!repairMovement) throw new Error('expected one movement');
      expect(repairMovement.type).toBe(MovementType.PENDING_REPAIR);
    });

    it('release is idempotent: releasing more than reserved clamps to 0 and writes nothing when already at 0', async () => {
      const { tx, getProduct, getMovements } = createFakeTx(buildProduct({ quantityOnHand: 10, quantityReserved: 3 }));

      await engine.release(tx, PRODUCT_ID, 10, buildRef()); // over-release clamps
      expect(getProduct().quantityReserved).toBe(0);
      const movementsAfterFirst = getMovements().length;

      await engine.release(tx, PRODUCT_ID, 5, buildRef()); // already 0 — true no-op
      expect(getProduct().quantityReserved).toBe(0);
      expect(getMovements()).toHaveLength(movementsAfterFirst); // no new row written
    });

    it('writes a signed PENDING_RELEASE quantity', async () => {
      const { tx, getMovements } = createFakeTx(buildProduct({ quantityOnHand: 10, quantityReserved: 5 }));

      await engine.release(tx, PRODUCT_ID, 5, buildRef());

      const [release] = getMovements().filter((m) => m.type === MovementType.PENDING_RELEASE);
      if (!release) throw new Error('expected one PENDING_RELEASE movement');
      expect(release.quantity).toBe(-5);
    });
  });

  describe('returnIn', () => {
    it('re-enters stock at the original consumed cost, not current averageCost', async () => {
      const { tx, getProduct, getMovements } = createFakeTx(buildProduct({ quantityOnHand: 0 }));
      await engine.addLayer(tx, PRODUCT_ID, 10, 100, MovementType.SUPPLIER_INVOICE, buildRef());
      await engine.addLayer(tx, PRODUCT_ID, 10, 150, MovementType.SUPPLIER_INVOICE, buildRef());
      const consumeResult = await engine.consumeFifo(tx, PRODUCT_ID, 15, 3000, MovementType.SALE, buildRef());
      // consumeResult.consumptions: [{100 x10}, {150 x5}] — return only the last 5 units (@150).
      const returned = consumeResult.consumptions.filter((c) => c.unitCost === 150);

      await engine.returnIn(tx, returned, 5, buildRef());

      const [returnMovement] = getMovements().filter((m) => m.type === MovementType.RETURN_IN);
      if (!returnMovement) throw new Error('expected one RETURN_IN movement');
      expect(returnMovement.unitCost?.toNumber()).toBe(150); // not the blended/current avgCost
      expect(getProduct().quantityOnHand).toBe(10); // 5 remaining (5@150) + 5 returned
    });

    it('recreates one layer per distinct original cost when a return spans multiple costs', async () => {
      const { tx, getMovements } = createFakeTx(buildProduct({ quantityOnHand: 0 }));
      await engine.addLayer(tx, PRODUCT_ID, 10, 100, MovementType.SUPPLIER_INVOICE, buildRef());
      await engine.addLayer(tx, PRODUCT_ID, 10, 150, MovementType.SUPPLIER_INVOICE, buildRef());
      const consumeResult = await engine.consumeFifo(tx, PRODUCT_ID, 15, 3000, MovementType.SALE, buildRef());

      await engine.returnIn(tx, consumeResult.consumptions, 15, buildRef());

      const returnLayers = getMovements().filter((m) => m.type === MovementType.RETURN_IN);
      expect(returnLayers).toHaveLength(2); // one per distinct original cost (100 and 150)
      expect(returnLayers.map((m) => m.unitCost?.toNumber()).sort()).toEqual([100, 150]);
    });

    it('rejects when qty does not match the sum of originalConsumptions', async () => {
      const { tx } = createFakeTx(buildProduct({ quantityOnHand: 0 }));
      await engine.addLayer(tx, PRODUCT_ID, 10, 100, MovementType.SUPPLIER_INVOICE, buildRef());
      const consumeResult = await engine.consumeFifo(tx, PRODUCT_ID, 5, 100, MovementType.SALE, buildRef());

      await expect(engine.returnIn(tx, consumeResult.consumptions, 999, buildRef())).rejects.toThrow(/does not match/);
    });
  });

  describe('invariants across an interleaved sequence', () => {
    it('onHand = Σmovements, Σremaining(IN) = onHand, reserved = ΣPENDING, balanceAfter chains correctly', async () => {
      const { tx, getProduct, getMovements } = createFakeTx(buildProduct({ quantityOnHand: 0, quantityReserved: 0 }));

      await engine.addLayer(tx, PRODUCT_ID, 10, 100, MovementType.SUPPLIER_INVOICE, buildRef()); // onHand 10
      await engine.reserve(tx, PRODUCT_ID, 3, buildRef({ referenceType: 'ORDER' })); // reserved 3
      await engine.addLayer(tx, PRODUCT_ID, 10, 150, MovementType.SUPPLIER_INVOICE, buildRef()); // onHand 20
      await engine.consumeFifo(tx, PRODUCT_ID, 4, 800, MovementType.SALE, buildRef()); // onHand 16
      await engine.release(tx, PRODUCT_ID, 3, buildRef({ referenceType: 'ORDER' })); // reserved 0

      const product = getProduct();
      const movements = getMovements();

      const onHandFromMovements = movements
        .filter((m) => m.direction === 'IN' || m.direction === 'OUT')
        .reduce((sum, m) => sum + m.quantity, 0);
      expect(onHandFromMovements).toBe(product.quantityOnHand);

      const remainingSum = movements.filter((m) => m.direction === 'IN').reduce((sum, m) => sum + (m.remainingQuantity ?? 0), 0);
      expect(remainingSum).toBe(product.quantityOnHand);

      const reservedFromMovements = movements.filter((m) => m.direction === 'PENDING').reduce((sum, m) => sum + m.quantity, 0);
      expect(reservedFromMovements).toBe(product.quantityReserved);

      // balanceAfter on every IN/OUT row equals the running onHand at the time it was written.
      let runningOnHand = 0;
      for (const m of movements.filter((mv) => mv.direction === 'IN' || mv.direction === 'OUT').sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
        runningOnHand += m.quantity;
        expect(m.balanceAfter).toBe(runningOnHand);
      }
    });
  });

  describe('flushEvents', () => {
    it('does not emit anything before flush is called (buffered, not immediate)', async () => {
      const { tx } = createFakeTx(buildProduct({ quantityOnHand: 10 }));
      await engine.addLayer(tx, PRODUCT_ID, 5, 100, MovementType.SUPPLIER_INVOICE, buildRef());
      expect(eventBusEmitMock).not.toHaveBeenCalled();
    });

    it('flushing twice only emits once (buffer is cleared after flush)', async () => {
      const { tx } = createFakeTx(buildProduct({ quantityOnHand: 10 }));
      await engine.addLayer(tx, PRODUCT_ID, 5, 100, MovementType.SUPPLIER_INVOICE, buildRef());

      engine.flushEvents(tx);
      expect(eventBusEmitMock).toHaveBeenCalledTimes(1);
      eventBusEmitMock.mockClear();

      engine.flushEvents(tx);
      expect(eventBusEmitMock).not.toHaveBeenCalled();
    });

    it('flushing a tx with no buffered events is a harmless no-op', () => {
      const { tx } = createFakeTx(buildProduct());
      expect(() => engine.flushEvents(tx)).not.toThrow();
      expect(eventBusEmitMock).not.toHaveBeenCalled();
    });
  });

  describe('unknown product', () => {
    it('throws NotFoundError when the product does not exist', async () => {
      const { tx } = createFakeTx(buildProduct());

      await expect(engine.addLayer(tx, 'missing-id', 5, 100, MovementType.SUPPLIER_INVOICE, buildRef())).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});

const {
  productFindManyMock,
  productFindUniqueMock,
  stockAdjustmentCreateMock,
  stockAdjustmentLineCreateMock,
  stockMovementFindManyMock,
  stockMovementCountMock,
  stockMovementGroupByMock,
  stockAdjustmentFindManyMock,
  supplierInvoiceFindManyMock,
  transactionMock,
} = vi.hoisted(() => ({
  productFindManyMock: vi.fn(),
  productFindUniqueMock: vi.fn(),
  stockAdjustmentCreateMock: vi.fn(),
  stockAdjustmentLineCreateMock: vi.fn(),
  stockMovementFindManyMock: vi.fn(),
  stockMovementCountMock: vi.fn(),
  stockMovementGroupByMock: vi.fn(),
  stockAdjustmentFindManyMock: vi.fn(),
  supplierInvoiceFindManyMock: vi.fn(),
  transactionMock: vi.fn(),
}));

const prismaMock = {
  product: { findMany: productFindManyMock, findUnique: productFindUniqueMock },
  stockAdjustment: { create: stockAdjustmentCreateMock, findMany: stockAdjustmentFindManyMock },
  stockAdjustmentLine: { create: stockAdjustmentLineCreateMock },
  stockMovement: {
    findMany: stockMovementFindManyMock,
    count: stockMovementCountMock,
    groupBy: stockMovementGroupByMock,
  },
  supplierInvoice: { findMany: supplierInvoiceFindManyMock },
  $transaction: transactionMock,
};

const buildProductRow = (overrides: Partial<Product> = {}): Product => ({
  id: PRODUCT_ID,
  sku: 'SKU-1',
  barcode: null,
  name: 'Screen Protector',
  description: null,
  familyId: 'family-id',
  brandId: 'brand-id',
  deviceModelId: null,
  guestPrice: null,
  defaultSalePrice: null,
  averageCost: new Prisma.Decimal(0),
  quantityOnHand: 0,
  quantityReserved: 0,
  reorderThreshold: 0,
  isPublished: false,
  isEnabled: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const buildMovementRow = (
  overrides: Partial<StockMovement> = {},
  product: { name: string } = { name: 'Screen Protector' },
  staff: { firstName: string; lastName: string } = { firstName: 'Amine', lastName: 'Belkacem' },
) => ({
  id: MOVEMENT_ID,
  productId: PRODUCT_ID,
  direction: 'IN',
  type: 'SUPPLIER_INVOICE',
  quantity: 10,
  unitCost: new Prisma.Decimal(100),
  remainingQuantity: 10,
  costOfGoods: null,
  profit: null,
  balanceAfter: 10,
  referenceType: 'SUPPLIER_INVOICE',
  referenceId: ORDER_ID,
  reason: null,
  staffId: STAFF_ID,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
  product,
  staff,
});

describe('InventoryReadService', () => {
  const sequenceMock = { nextNumber: vi.fn() };
  const catalogPricingMock = { applyPricing: vi.fn() };
  const engineMock = {
    reserve: vi.fn(),
    release: vi.fn(),
    addLayer: vi.fn(),
    consumeFifo: vi.fn(),
    returnIn: vi.fn(),
    flushEvents: vi.fn(),
  };

  const service = () =>
    new InventoryReadService(prismaMock as never, sequenceMock as never, catalogPricingMock as never, engineMock as never);

  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
    // Safe defaults for the batched referenceLabel lookups — buildMovementRow() defaults to a
    // SUPPLIER_INVOICE reference, so listMovements always calls these; tests that care about the
    // resolved label override with their own mockResolvedValueOnce.
    stockAdjustmentFindManyMock.mockResolvedValue([]);
    supplierInvoiceFindManyMock.mockResolvedValue([]);
  });

  describe('getStock', () => {
    it('derives availableQuantity/stockValue/isLow per row', async () => {
      productFindManyMock.mockResolvedValueOnce([
        buildProductRow({ quantityOnHand: 20, quantityReserved: 5, averageCost: new Prisma.Decimal(100), reorderThreshold: 10 }),
      ]);

      const rows = (await service().getStock({})) as StockRowDto[];

      expect(rows[0]?.availableQuantity).toBe(15);
      expect(rows[0]?.stockValue).toBe(2000);
      expect(rows[0]?.isLow).toBe(false);
    });

    it('lowStockOnly filters to isLow rows only', async () => {
      const NOT_LOW_ID = '77777777-7777-4777-8777-777777777777';
      const LOW_ID = '88888888-8888-4888-8888-888888888888';
      productFindManyMock.mockResolvedValueOnce([
        buildProductRow({ id: NOT_LOW_ID, quantityOnHand: 20, quantityReserved: 0, reorderThreshold: 5 }),
        buildProductRow({ id: LOW_ID, quantityOnHand: 3, quantityReserved: 0, reorderThreshold: 5 }),
      ]);

      const rows = (await service().getStock({ lowStockOnly: true })) as StockRowDto[];

      expect(rows).toHaveLength(1);
      expect(rows[0]?.productId).toBe(LOW_ID);
    });

    it('export=csv returns a CSV ExportResult with a header row', async () => {
      productFindManyMock.mockResolvedValueOnce([buildProductRow({})]);

      const result = (await service().getStock({ export: 'csv' })) as ExportResult;

      expect(result.mime).toBe('text/csv');
      expect(result.filename).toMatch(/\.csv$/);
      expect(String(result.body).split('\n')[0]).toContain('productId');
      expect(String(result.body).split('\n')).toHaveLength(2); // header + 1 row
    });
  });

  describe('listMovements', () => {
    it('paginates and builds the meta block', async () => {
      stockMovementCountMock.mockResolvedValueOnce(1);
      stockMovementFindManyMock.mockResolvedValueOnce([buildMovementRow()]);

      const result = await service().listMovements({ page: 1, limit: 20 });

      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(result.items).toHaveLength(1);
    });

    it('resolves a PRODUCT referenceLabel from the already-joined product name (no extra query)', async () => {
      stockMovementCountMock.mockResolvedValueOnce(1);
      stockMovementFindManyMock.mockResolvedValueOnce([
        buildMovementRow({ referenceType: 'PRODUCT', referenceId: PRODUCT_ID }, { name: 'Screen Protector' }),
      ]);

      const result = await service().listMovements({ page: 1, limit: 20 });

      expect(result.items[0]?.referenceLabel).toBe('Screen Protector');
      expect(stockAdjustmentFindManyMock).not.toHaveBeenCalled();
    });

    it('resolves an ADJUSTMENT referenceLabel via a batched StockAdjustment lookup', async () => {
      stockMovementCountMock.mockResolvedValueOnce(1);
      stockMovementFindManyMock.mockResolvedValueOnce([
        buildMovementRow({ referenceType: 'ADJUSTMENT', referenceId: ADJUSTMENT_ID }),
      ]);
      stockAdjustmentFindManyMock.mockResolvedValueOnce([{ id: ADJUSTMENT_ID, reference: 'ADJ-2026-0001' }]);

      const result = await service().listMovements({ page: 1, limit: 20 });

      expect(result.items[0]?.referenceLabel).toBe('ADJ-2026-0001');
      expect(stockAdjustmentFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [ADJUSTMENT_ID] } } }),
      );
    });

    it('falls back to "type shortId" for reference types with no backing lookup yet (e.g. SALE)', async () => {
      const saleRefId = '99999999-9999-4999-8999-999999999999';
      stockMovementCountMock.mockResolvedValueOnce(1);
      stockMovementFindManyMock.mockResolvedValueOnce([buildMovementRow({ referenceType: 'SALE', referenceId: saleRefId })]);

      const result = await service().listMovements({ page: 1, limit: 20 });

      expect(result.items[0]?.referenceLabel).toBe('SALE 99999999');
    });

    it('maps productId/type/staffId/date-range filters onto the Prisma where clause', async () => {
      stockMovementCountMock.mockResolvedValueOnce(0);
      stockMovementFindManyMock.mockResolvedValueOnce([]);

      await service().listMovements({
        productId: PRODUCT_ID,
        type: MovementType.SALE,
        staffId: STAFF_ID,
        from: '2026-01-01',
        to: '2026-01-02',
        page: 1,
        limit: 20,
      });

      expect(stockMovementFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            productId: PRODUCT_ID,
            type: MovementType.SALE,
            staffId: STAFF_ID,
            createdAt: { gte: new Date('2026-01-01'), lt: new Date('2026-01-03') },
          },
        }),
      );
    });
  });

  describe('listReservations', () => {
    afterEach(() => vi.useRealTimers());

    it('aggregates open PENDING movements: holderType from referenceType, ageHours from the earliest reserve', async () => {
      vi.useFakeTimers().setSystemTime(new Date('2026-01-01T03:00:00.000Z'));
      stockMovementGroupByMock.mockResolvedValueOnce([
        {
          productId: PRODUCT_ID,
          referenceType: 'ORDER',
          referenceId: ORDER_ID,
          _sum: { quantity: 5 },
          _min: { createdAt: new Date('2026-01-01T00:00:00.000Z') },
        },
      ]);
      productFindManyMock.mockResolvedValueOnce([{ id: PRODUCT_ID, name: 'Screen Protector' }]);

      const result = await service().listReservations({ page: 1, limit: 20 });

      expect(result.items).toEqual([
        {
          productId: PRODUCT_ID,
          productName: 'Screen Protector',
          quantity: 5,
          holderType: ReservationHolderType.ORDER,
          holderReference: `ORDER ${ORDER_ID.slice(0, 8)}`,
          ageHours: 3,
        },
      ]);
    });

    it('derives holderType REPAIR for a REPAIR referenceType', async () => {
      stockMovementGroupByMock.mockResolvedValueOnce([
        {
          productId: PRODUCT_ID,
          referenceType: 'REPAIR',
          referenceId: REPAIR_ID,
          _sum: { quantity: 2 },
          _min: { createdAt: new Date('2026-01-01T00:00:00.000Z') },
        },
      ]);
      productFindManyMock.mockResolvedValueOnce([{ id: PRODUCT_ID, name: 'Screen Protector' }]);

      const result = await service().listReservations({ page: 1, limit: 20 });

      expect(result.items[0]?.holderType).toBe(ReservationHolderType.REPAIR);
    });

    it('excludes fully-released holders (net summed quantity <= 0)', async () => {
      stockMovementGroupByMock.mockResolvedValueOnce([
        {
          productId: PRODUCT_ID,
          referenceType: 'ORDER',
          referenceId: ORDER_ID,
          _sum: { quantity: 0 },
          _min: { createdAt: new Date() },
        },
      ]);

      const result = await service().listReservations({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('createAdjustment', () => {
    it('creates an ADJUSTMENT_IN layer for a positive delta, defaulting unitCost to the current averageCost', async () => {
      sequenceMock.nextNumber.mockResolvedValueOnce('ADJ-2026-0001');
      stockAdjustmentCreateMock.mockResolvedValueOnce({ id: ADJUSTMENT_ID, reference: 'ADJ-2026-0001' });
      productFindUniqueMock.mockResolvedValueOnce(buildProductRow({ quantityOnHand: 10, averageCost: new Prisma.Decimal(120) }));
      engineMock.addLayer.mockResolvedValueOnce({ movementId: MOVEMENT_ID });

      const result = await service().createAdjustment(
        { reason: AdjustmentReason.COUNT, lines: [{ productId: PRODUCT_ID, countedQuantity: 15 }] },
        STAFF_ID,
      );

      expect(engineMock.addLayer).toHaveBeenCalledWith(
        prismaMock,
        PRODUCT_ID,
        5,
        120,
        MovementType.ADJUSTMENT_IN,
        expect.objectContaining({ referenceType: 'ADJUSTMENT', referenceId: ADJUSTMENT_ID, staffId: STAFF_ID }),
      );
      expect(result.reference).toBe('ADJ-2026-0001');
      expect(result.lines).toEqual([{ productId: PRODUCT_ID, delta: 5, movementId: MOVEMENT_ID }]);
    });

    it('honours an explicit unitCost over the current averageCost for a positive delta', async () => {
      sequenceMock.nextNumber.mockResolvedValueOnce('ADJ-2026-0002');
      stockAdjustmentCreateMock.mockResolvedValueOnce({ id: ADJUSTMENT_ID, reference: 'ADJ-2026-0002' });
      productFindUniqueMock.mockResolvedValueOnce(buildProductRow({ quantityOnHand: 10, averageCost: new Prisma.Decimal(120) }));
      engineMock.addLayer.mockResolvedValueOnce({ movementId: MOVEMENT_ID });

      await service().createAdjustment(
        { reason: AdjustmentReason.COUNT, lines: [{ productId: PRODUCT_ID, countedQuantity: 15, unitCost: 200 }] },
        STAFF_ID,
      );

      expect(engineMock.addLayer).toHaveBeenCalledWith(prismaMock, PRODUCT_ID, 5, 200, MovementType.ADJUSTMENT_IN, expect.anything());
    });

    it('consumes FIFO for a negative delta with revenue=null, keeping profit null', async () => {
      sequenceMock.nextNumber.mockResolvedValueOnce('ADJ-2026-0003');
      stockAdjustmentCreateMock.mockResolvedValueOnce({ id: ADJUSTMENT_ID, reference: 'ADJ-2026-0003' });
      productFindUniqueMock.mockResolvedValueOnce(buildProductRow({ quantityOnHand: 10 }));
      engineMock.consumeFifo.mockResolvedValueOnce({ movementId: MOVEMENT_ID, costOfGoods: 500, profit: null, consumptions: [] });

      const result = await service().createAdjustment(
        { reason: AdjustmentReason.DAMAGE, lines: [{ productId: PRODUCT_ID, countedQuantity: 5 }] },
        STAFF_ID,
      );

      expect(engineMock.consumeFifo).toHaveBeenCalledWith(
        prismaMock,
        PRODUCT_ID,
        5,
        null,
        MovementType.ADJUSTMENT_OUT,
        expect.objectContaining({ referenceType: 'ADJUSTMENT' }),
      );
      expect(result.lines).toEqual([{ productId: PRODUCT_ID, delta: -5, movementId: MOVEMENT_ID }]);
    });

    it('a zero-delta reprice-only line calls applyPricing but produces no result line', async () => {
      sequenceMock.nextNumber.mockResolvedValueOnce('ADJ-2026-0004');
      stockAdjustmentCreateMock.mockResolvedValueOnce({ id: ADJUSTMENT_ID, reference: 'ADJ-2026-0004' });
      productFindUniqueMock.mockResolvedValueOnce(buildProductRow({ quantityOnHand: 10 }));

      const result = await service().createAdjustment(
        {
          reason: AdjustmentReason.CORRECTION,
          lines: [{ productId: PRODUCT_ID, countedQuantity: 10, prices: { guestPrice: 999 } }],
        },
        STAFF_ID,
      );

      expect(catalogPricingMock.applyPricing).toHaveBeenCalledWith(prismaMock, PRODUCT_ID, { guestPrice: 999 });
      expect(engineMock.addLayer).not.toHaveBeenCalled();
      expect(engineMock.consumeFifo).not.toHaveBeenCalled();
      expect(result.lines).toHaveLength(0);
    });

    it('applies the reprice in the same transaction as a non-zero delta', async () => {
      sequenceMock.nextNumber.mockResolvedValueOnce('ADJ-2026-0005');
      stockAdjustmentCreateMock.mockResolvedValueOnce({ id: ADJUSTMENT_ID, reference: 'ADJ-2026-0005' });
      productFindUniqueMock.mockResolvedValueOnce(buildProductRow({ quantityOnHand: 10, averageCost: new Prisma.Decimal(100) }));
      engineMock.addLayer.mockResolvedValueOnce({ movementId: MOVEMENT_ID });

      await service().createAdjustment(
        {
          reason: AdjustmentReason.COUNT,
          lines: [{ productId: PRODUCT_ID, countedQuantity: 15, prices: { guestPrice: 500 } }],
        },
        STAFF_ID,
      );

      expect(catalogPricingMock.applyPricing).toHaveBeenCalledWith(prismaMock, PRODUCT_ID, { guestPrice: 500 });
      expect(engineMock.addLayer).toHaveBeenCalledWith(prismaMock, PRODUCT_ID, 5, 100, MovementType.ADJUSTMENT_IN, expect.anything());
    });

    it('flushes engine events and emits inventory.adjusted exactly once after commit', async () => {
      sequenceMock.nextNumber.mockResolvedValueOnce('ADJ-2026-0006');
      stockAdjustmentCreateMock.mockResolvedValueOnce({ id: ADJUSTMENT_ID, reference: 'ADJ-2026-0006' });
      productFindUniqueMock.mockResolvedValueOnce(buildProductRow({ quantityOnHand: 10 }));
      engineMock.addLayer.mockResolvedValueOnce({ movementId: MOVEMENT_ID });

      await service().createAdjustment(
        { reason: AdjustmentReason.COUNT, lines: [{ productId: PRODUCT_ID, countedQuantity: 15 }] },
        STAFF_ID,
      );

      expect(engineMock.flushEvents).toHaveBeenCalledTimes(1);
      expect(engineMock.flushEvents).toHaveBeenCalledWith(prismaMock);
      expect(eventBusEmitMock).toHaveBeenCalledTimes(1);
      expect(eventBusEmitMock).toHaveBeenCalledWith(
        'inventory.adjusted',
        expect.objectContaining({ reference: 'ADJ-2026-0006' }),
      );
    });

    it('rejects when a line references an unknown product', async () => {
      sequenceMock.nextNumber.mockResolvedValueOnce('ADJ-2026-0007');
      stockAdjustmentCreateMock.mockResolvedValueOnce({ id: ADJUSTMENT_ID, reference: 'ADJ-2026-0007' });
      productFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service().createAdjustment(
          { reason: AdjustmentReason.COUNT, lines: [{ productId: 'missing-id', countedQuantity: 5 }] },
          STAFF_ID,
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});

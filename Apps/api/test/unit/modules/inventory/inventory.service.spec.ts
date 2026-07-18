import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import type { Product } from '@prisma/client';
import { MovementType } from '@dragon-telecom/contract';
import { InventoryService } from '../../../../src/modules/inventory/inventory.service';
import type { MovementRef } from '../../../../src/modules/inventory/inventory.interface';

const { eventBusEmitMock } = vi.hoisted(() => ({ eventBusEmitMock: vi.fn() }));
vi.mock('@common/events/event-bus', () => ({ eventBus: { emit: eventBusEmitMock } }));

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_ID = '22222222-2222-4222-8222-222222222222';
const ORDER_ID = '33333333-3333-4333-8333-333333333333';
const REPAIR_ID = '44444444-4444-4444-8444-444444444444';

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

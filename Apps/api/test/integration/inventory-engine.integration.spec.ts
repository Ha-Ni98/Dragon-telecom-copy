import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { MovementType } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';
import { eventBus } from '../../src/common/events/event-bus';
import { resetDatabase } from '../fixtures/db.fixture';
import { seedBrand } from '../data/brand.factory';
import { seedFamily } from '../data/family.factory';
import { seedProduct } from '../data/product.factory';
import { seedStaff } from '../data/staff.factory';
import { inventoryService } from '../../src/modules/inventory/inventory.routes';
import type { MovementRef } from '../../src/modules/inventory/inventory.interface';

// Proves the injected-engine contract against a *real* Postgres transaction (Sprint 2's unit
// tests proved the same shape against a fake tx) — the spec's own rationale for the whole
// injected-service design: "events can't return FIFO results, and splitting the transaction
// could leave a sale without its movement." A generic caller here stands in for any future
// document module (orders/sales/purchasing/repairs), independent of inventory's own HTTP surface.
describe('inventory engine — cross-module transaction proof', () => {
  let productId: string;
  let ref: MovementRef;

  beforeEach(async () => {
    await resetDatabase();
    const brand = await seedBrand();
    const family = await seedFamily();
    const product = await seedProduct({ brandId: brand.id, familyId: family.id, quantityOnHand: 0 });
    const staff = await seedStaff();
    productId = product.id;
    ref = { referenceType: 'SUPPLIER_INVOICE', referenceId: product.id, staffId: staff.id };
  });

  it('commit: the movement and column deltas persist, and buffered events flush after', async () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    let capturedTx: Prisma.TransactionClient | undefined;

    await prisma.$transaction(async (tx) => {
      capturedTx = tx;
      await inventoryService.addLayer(tx, productId, 10, 200, MovementType.SUPPLIER_INVOICE, ref);
    });

    expect(emitSpy).not.toHaveBeenCalled(); // not yet — only buffered until the caller flushes
    inventoryService.flushEvents(capturedTx!);
    expect(emitSpy).toHaveBeenCalledWith(
      'inventory.stockChanged',
      expect.objectContaining({ productId, onHand: 10 }),
    );

    const rows = await prisma.stockMovement.findMany({ where: { productId } });
    expect(rows).toHaveLength(1);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(product.quantityOnHand).toBe(10);

    emitSpy.mockRestore();
  });

  it('rollback (caller throws after a successful engine call): nothing persists, no event ever fires', async () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');

    await expect(
      prisma.$transaction(async (tx) => {
        await inventoryService.addLayer(tx, productId, 10, 200, MovementType.SUPPLIER_INVOICE, ref);
        throw new Error('simulated failure elsewhere in the caller-s own transaction');
      }),
    ).rejects.toThrow('simulated failure');

    // The engine had already buffered a stockChanged event before the throw — proving the
    // caller never flushing it (because it never reached the post-$transaction line) means it
    // is simply discarded, not delivered late.
    expect(emitSpy).not.toHaveBeenCalled();

    const rows = await prisma.stockMovement.findMany({ where: { productId } });
    expect(rows).toHaveLength(0);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(product.quantityOnHand).toBe(0);

    emitSpy.mockRestore();
  });

  it('rollback (a genuine engine rejection): an earlier successful step in the same transaction is undone too', async () => {
    const brand = await seedBrand();
    const family = await seedFamily();
    const secondProduct = await seedProduct({ brandId: brand.id, familyId: family.id, quantityOnHand: 0 });

    // Simulates a two-line document (e.g. a future order) that adds stock to one product and
    // then tries to over-consume another — a single business-rule failure must roll back the
    // WHOLE document, not just the failing line ("a sale without its movement" guarantee).
    await expect(
      prisma.$transaction(async (tx) => {
        await inventoryService.addLayer(tx, productId, 5, 100, MovementType.SUPPLIER_INVOICE, ref);
        await inventoryService.consumeFifo(tx, secondProduct.id, 999, 100, MovementType.SALE, {
          referenceType: 'SALE',
          referenceId: secondProduct.id,
          staffId: ref.staffId,
        });
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const firstProductAfter = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(firstProductAfter.quantityOnHand).toBe(0); // the earlier addLayer was rolled back too
    const movements = await prisma.stockMovement.findMany({ where: { productId } });
    expect(movements).toHaveLength(0);
  });
});

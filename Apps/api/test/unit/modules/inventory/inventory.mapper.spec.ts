import { describe, it, expect } from 'vitest';
import type { Product, StockAdjustment, StockMovement, Staff } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { MovementDirection, MovementType, ReservationHolderType } from '@dragon-telecom/contract';
import { InventoryMapper, type ReservationGroup } from '../../../../src/modules/inventory/inventory.mapper';

const now = new Date('2026-01-01T00:00:00.000Z');

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const MOVEMENT_ID = '22222222-2222-4222-8222-222222222222';
const REFERENCE_ID = '33333333-3333-4333-8333-333333333333';
const STAFF_ID = '44444444-4444-4444-8444-444444444444';
const ADJUSTMENT_ID = '55555555-5555-4555-8555-555555555555';

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
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const buildMovement = (overrides: Partial<StockMovement> = {}): StockMovement => ({
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
  referenceId: REFERENCE_ID,
  reason: null,
  staffId: STAFF_ID,
  createdAt: now,
  ...overrides,
});

const buildStaff = (overrides: Partial<Staff> = {}): Pick<Staff, 'firstName' | 'lastName'> => ({
  firstName: 'Amine',
  lastName: 'Belkacem',
  ...overrides,
});

const buildAdjustment = (overrides: Partial<StockAdjustment> = {}): Pick<StockAdjustment, 'reference'> => ({
  reference: 'ADJ-0001',
  ...overrides,
});

describe('InventoryMapper', () => {
  describe('toStockRowDto', () => {
    it('derives availableQuantity, stockValue, and isLow', () => {
      const dto = InventoryMapper.toStockRowDto(
        buildProduct({ quantityOnHand: 20, quantityReserved: 5, averageCost: new Prisma.Decimal(150), reorderThreshold: 10 }),
      );
      expect(dto.availableQuantity).toBe(15);
      expect(dto.stockValue).toBe(3000); // 20 * 150
      expect(dto.isLow).toBe(false); // 15 > 10
    });

    it('flags isLow when available <= reorderThreshold', () => {
      const dto = InventoryMapper.toStockRowDto(
        buildProduct({ quantityOnHand: 10, quantityReserved: 5, reorderThreshold: 5 }),
      );
      expect(dto.availableQuantity).toBe(5);
      expect(dto.isLow).toBe(true);
    });

    it('converts averageCost from Decimal to number', () => {
      const dto = InventoryMapper.toStockRowDto(buildProduct({ averageCost: new Prisma.Decimal(1234.56) }));
      expect(dto.averageCost).toBe(1234.56);
    });

    it('omits barcode when null', () => {
      const dto = InventoryMapper.toStockRowDto(buildProduct({ barcode: null }));
      expect('barcode' in dto).toBe(false);
    });

    it('includes barcode when set', () => {
      const dto = InventoryMapper.toStockRowDto(buildProduct({ barcode: '123456789' }));
      expect(dto.barcode).toBe('123456789');
    });
  });

  describe('toMovementDto', () => {
    it('converts createdAt to an ISO string', () => {
      const dto = InventoryMapper.toMovementDto(
        buildMovement(),
        { name: 'Screen Protector' },
        buildStaff(),
        'SUPPLIER_INVOICE 33333333',
      );
      expect(dto.createdAt).toBe(now.toISOString());
    });

    it('composes staffName from firstName + lastName', () => {
      const dto = InventoryMapper.toMovementDto(
        buildMovement(),
        { name: 'Screen Protector' },
        buildStaff({ firstName: 'Yasmine', lastName: 'Cherif' }),
        'label',
      );
      expect(dto.staffName).toBe('Yasmine Cherif');
    });

    it('passes direction/type through as the contract enums', () => {
      const dto = InventoryMapper.toMovementDto(
        buildMovement({ direction: 'OUT', type: 'SALE' }),
        { name: 'Screen Protector' },
        buildStaff(),
        'label',
      );
      expect(dto.direction).toBe(MovementDirection.OUT);
      expect(dto.type).toBe(MovementType.SALE);
    });

    it('includes unitCost/remainingQuantity for an IN row and converts Decimal to number', () => {
      const dto = InventoryMapper.toMovementDto(
        buildMovement({ unitCost: new Prisma.Decimal(150), remainingQuantity: 7 }),
        { name: 'Screen Protector' },
        buildStaff(),
        'label',
      );
      expect(dto.unitCost).toBe(150);
      expect(dto.remainingQuantity).toBe(7);
      expect('costOfGoods' in dto).toBe(false);
      expect('profit' in dto).toBe(false);
    });

    it('includes costOfGoods/profit for an OUT row and omits unitCost/remainingQuantity when null', () => {
      const dto = InventoryMapper.toMovementDto(
        buildMovement({
          direction: 'OUT',
          type: 'SALE',
          unitCost: null,
          remainingQuantity: null,
          costOfGoods: new Prisma.Decimal(1750),
          profit: new Prisma.Decimal(250),
        }),
        { name: 'Screen Protector' },
        buildStaff(),
        'label',
      );
      expect('unitCost' in dto).toBe(false);
      expect('remainingQuantity' in dto).toBe(false);
      expect(dto.costOfGoods).toBe(1750);
      expect(dto.profit).toBe(250);
    });

    it('omits profit when null (ADJUSTMENT_OUT)', () => {
      const dto = InventoryMapper.toMovementDto(
        buildMovement({ direction: 'OUT', type: 'ADJUSTMENT_OUT', costOfGoods: new Prisma.Decimal(500), profit: null }),
        { name: 'Screen Protector' },
        buildStaff(),
        'label',
      );
      expect(dto.costOfGoods).toBe(500);
      expect('profit' in dto).toBe(false);
    });

    it('omits reason when null and includes it when set', () => {
      const omitted = InventoryMapper.toMovementDto(buildMovement({ reason: null }), { name: 'x' }, buildStaff(), 'label');
      expect('reason' in omitted).toBe(false);

      const included = InventoryMapper.toMovementDto(
        buildMovement({ reason: 'Recount' }),
        { name: 'x' },
        buildStaff(),
        'label',
      );
      expect(included.reason).toBe('Recount');
    });

    it('carries referenceType/referenceId and the supplied referenceLabel through', () => {
      const dto = InventoryMapper.toMovementDto(
        buildMovement({ referenceType: 'ADJUSTMENT', referenceId: ADJUSTMENT_ID }),
        { name: 'x' },
        buildStaff(),
        'ADJ-0001',
      );
      expect(dto.referenceType).toBe('ADJUSTMENT');
      expect(dto.referenceId).toBe(ADJUSTMENT_ID);
      expect(dto.referenceLabel).toBe('ADJ-0001');
    });
  });

  describe('toReservationDto', () => {
    it('carries the group fields plus the joined productName', () => {
      const group: ReservationGroup = {
        productId: PRODUCT_ID,
        quantity: 5,
        holderType: ReservationHolderType.ORDER,
        holderReference: 'ORD-0001',
        ageHours: 3.5,
      };
      const dto = InventoryMapper.toReservationDto(group, { name: 'Screen Protector' });
      expect(dto).toEqual({
        productId: PRODUCT_ID,
        productName: 'Screen Protector',
        quantity: 5,
        holderType: ReservationHolderType.ORDER,
        holderReference: 'ORD-0001',
        ageHours: 3.5,
      });
    });
  });

  describe('toAdjustmentResultDto', () => {
    it('carries the reference and per-line deltas/movementIds', () => {
      const dto = InventoryMapper.toAdjustmentResultDto(buildAdjustment({ reference: 'ADJ-0042' }), [
        { productId: PRODUCT_ID, delta: 5, movementId: MOVEMENT_ID },
        { productId: REFERENCE_ID, delta: -2, movementId: ADJUSTMENT_ID },
      ]);
      expect(dto.reference).toBe('ADJ-0042');
      expect(dto.lines).toEqual([
        { productId: PRODUCT_ID, delta: 5, movementId: MOVEMENT_ID },
        { productId: REFERENCE_ID, delta: -2, movementId: ADJUSTMENT_ID },
      ]);
    });
  });

  describe('resolveReferenceLabel', () => {
    it('returns the resolved name when supplied', () => {
      expect(InventoryMapper.resolveReferenceLabel('ADJUSTMENT', ADJUSTMENT_ID, 'ADJ-0001')).toBe('ADJ-0001');
    });

    it('falls back to "type + short id" when no resolved name is supplied (unbuilt document module)', () => {
      const label = InventoryMapper.resolveReferenceLabel('SALE', '99999999-9999-4999-8999-999999999999');
      expect(label).toBe('SALE 99999999');
    });
  });

  describe('availableQuantity', () => {
    it('computes onHand minus reserved', () => {
      expect(InventoryMapper.availableQuantity({ quantityOnHand: 20, quantityReserved: 5 })).toBe(15);
    });
  });

  describe('isLow', () => {
    it('is true when available <= reorderThreshold, false otherwise', () => {
      expect(InventoryMapper.isLow(5, 5)).toBe(true);
      expect(InventoryMapper.isLow(4, 5)).toBe(true);
      expect(InventoryMapper.isLow(6, 5)).toBe(false);
    });
  });

  describe('ageHours', () => {
    it('computes elapsed hours between two dates', () => {
      const since = new Date('2026-01-01T00:00:00.000Z');
      const nowRef = new Date('2026-01-01T03:30:00.000Z');
      expect(InventoryMapper.ageHours(since, nowRef)).toBe(3.5);
    });
  });
});

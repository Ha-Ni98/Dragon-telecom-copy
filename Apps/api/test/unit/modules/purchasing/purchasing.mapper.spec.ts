import { describe, it, expect } from 'vitest';
import type { Staff, Supplier, SupplierInvoice, SupplierInvoiceLine } from '@prisma/client';
import { Prisma, SupplierInvoiceStatus as PrismaSupplierInvoiceStatus } from '@prisma/client';
import { SupplierInvoiceStatus } from '@dragon-telecom/contract';
import {
  PurchasingMapper,
  type SupplierInvoiceRow,
  type SupplierPaymentRow,
} from '../../../../src/modules/purchasing/purchasing.mapper';

const now = new Date('2026-01-01T00:00:00.000Z');
const invoiceDate = new Date('2026-01-15T00:00:00.000Z');

const SUPPLIER_ID = '11111111-1111-4111-8111-111111111111';
const INVOICE_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333';
const LINE_ID = '44444444-4444-4444-8444-444444444444';
const STAFF_ID = '55555555-5555-4555-8555-555555555555';
const CATEGORY_ID = '66666666-6666-4666-8666-666666666666';

const buildSupplierRow = (overrides: Partial<Supplier> = {}): Supplier => ({
  id: SUPPLIER_ID,
  code: 'FRN-2026-0001',
  name: 'Acme Parts',
  contactName: null,
  phone: null,
  email: null,
  location: null,
  credit: new Prisma.Decimal(0),
  totalPaid: new Prisma.Decimal(0),
  totalInvoiced: new Prisma.Decimal(0),
  isEnabled: true,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const buildStaff = (overrides: Partial<Pick<Staff, 'firstName' | 'lastName'>> = {}) => ({
  firstName: 'John',
  lastName: 'Doe',
  ...overrides,
});

const buildLineRow = (overrides: Partial<SupplierInvoiceLine> & { projectedNewAverageCost?: number } = {}) => ({
  id: LINE_ID,
  supplierInvoiceId: INVOICE_ID,
  productId: PRODUCT_ID,
  productNameSnapshot: 'Screen Protector',
  quantity: 10,
  unitCost: new Prisma.Decimal(100),
  landedUnitCost: new Prisma.Decimal(105),
  lineTotal: new Prisma.Decimal(1000),
  serialNumbers: null,
  ...overrides,
});

const buildInvoiceRow = (overrides: Partial<SupplierInvoice> = {}, lines = [buildLineRow()]): SupplierInvoiceRow => ({
  id: INVOICE_ID,
  reference: 'SUP-2026-0001',
  supplierReference: null,
  supplierId: SUPPLIER_ID,
  status: PrismaSupplierInvoiceStatus.DRAFT,
  invoiceDate,
  dueDate: null,
  shippingCost: new Prisma.Decimal(50),
  amountOnly: null,
  totalAmount: new Prisma.Decimal(1050),
  paidAmount: new Prisma.Decimal(0),
  previousCredit: null,
  newCredit: null,
  note: null,
  staffId: STAFF_ID,
  createdAt: now,
  updatedAt: now,
  supplier: { name: 'Acme Parts' },
  staff: buildStaff(),
  lines,
  ...overrides,
});

const buildPaymentRow = (overrides: Record<string, unknown> = {}): SupplierPaymentRow => ({
  id: 'payment-1',
  reference: 'PAY-2026-0001',
  supplierId: SUPPLIER_ID,
  supplierInvoiceId: null,
  amount: new Prisma.Decimal(500),
  previousCredit: new Prisma.Decimal(1000),
  newCredit: new Prisma.Decimal(500),
  paidAt: now,
  staffId: STAFF_ID,
  supplier: { name: 'Acme Parts' },
  supplierInvoice: null,
  staff: buildStaff(),
  ...overrides,
} as SupplierPaymentRow);

describe('PurchasingMapper', () => {
  describe('toSupplierDto', () => {
    it('converts Decimal money fields and passes through invoiceCount', () => {
      const supplier = buildSupplierRow({
        credit: new Prisma.Decimal('-250.50'),
        totalPaid: new Prisma.Decimal(1000),
        totalInvoiced: new Prisma.Decimal(1500),
      });

      const dto = PurchasingMapper.toSupplierDto(supplier, { invoiceCount: 3 });

      expect(dto.credit).toBe(-250.5);
      expect(dto.totalPaid).toBe(1000);
      expect(dto.totalInvoiced).toBe(1500);
      expect(dto.invoiceCount).toBe(3);
    });

    it('includes lastDeliveryAt only when supplied, and optional contact fields only when set', () => {
      const supplier = buildSupplierRow({ contactName: 'Jane', phone: '0550000000' });

      const withDelivery = PurchasingMapper.toSupplierDto(supplier, { invoiceCount: 1, lastDeliveryAt: now });
      expect(withDelivery.lastDeliveryAt).toBe(now.toISOString());
      expect(withDelivery.contactName).toBe('Jane');
      expect(withDelivery.phone).toBe('0550000000');

      const withoutDelivery = PurchasingMapper.toSupplierDto(buildSupplierRow(), { invoiceCount: 0 });
      expect(withoutDelivery).not.toHaveProperty('lastDeliveryAt');
      expect(withoutDelivery).not.toHaveProperty('contactName');
      expect(withoutDelivery).not.toHaveProperty('phone');
    });
  });

  describe('toSupplierInvoiceDto', () => {
    it('converts invoiceDate/dueDate to date-only strings (not full ISO datetimes)', () => {
      const invoice = buildInvoiceRow({ dueDate: new Date('2026-02-01T00:00:00.000Z') });

      const dto = PurchasingMapper.toSupplierInvoiceDto(invoice);

      expect(dto.invoiceDate).toBe('2026-01-15');
      expect(dto.dueDate).toBe('2026-02-01');
    });

    it('omits previousCredit/newCredit on a DRAFT invoice', () => {
      const dto = PurchasingMapper.toSupplierInvoiceDto(buildInvoiceRow({ status: PrismaSupplierInvoiceStatus.DRAFT }));

      expect(dto).not.toHaveProperty('previousCredit');
      expect(dto).not.toHaveProperty('newCredit');
      expect(dto.status).toBe(SupplierInvoiceStatus.DRAFT);
    });

    it('includes previousCredit/newCredit once CONFIRMED', () => {
      const dto = PurchasingMapper.toSupplierInvoiceDto(
        buildInvoiceRow({
          status: PrismaSupplierInvoiceStatus.CONFIRMED,
          previousCredit: new Prisma.Decimal(0),
          newCredit: new Prisma.Decimal(1050),
        }),
      );

      expect(dto.previousCredit).toBe(0);
      expect(dto.newCredit).toBe(1050);
      expect(dto.status).toBe(SupplierInvoiceStatus.CONFIRMED);
    });

    it('composes staffName and maps line money fields', () => {
      const dto = PurchasingMapper.toSupplierInvoiceDto(buildInvoiceRow());

      expect(dto.staffName).toBe('John Doe');
      expect(dto.supplierName).toBe('Acme Parts');
      expect(dto.lines[0]).toMatchObject({ unitCost: 100, landedUnitCost: 105, lineTotal: 1000 });
    });

    it('includes lines[].projectedNewAverageCost only when the caller supplied it (DRAFT reads)', () => {
      const withProjection = PurchasingMapper.toSupplierInvoiceDto(
        buildInvoiceRow({}, [buildLineRow({ projectedNewAverageCost: 102.5 })]),
      );
      expect(withProjection.lines[0]?.projectedNewAverageCost).toBe(102.5);

      const withoutProjection = PurchasingMapper.toSupplierInvoiceDto(buildInvoiceRow({}, [buildLineRow()]));
      expect(withoutProjection.lines[0]).not.toHaveProperty('projectedNewAverageCost');
    });

    it('omits amountOnly/supplierReference/dueDate/note/serialNumbers when null', () => {
      const dto = PurchasingMapper.toSupplierInvoiceDto(buildInvoiceRow());

      expect(dto).not.toHaveProperty('amountOnly');
      expect(dto).not.toHaveProperty('supplierReference');
      expect(dto).not.toHaveProperty('dueDate');
      expect(dto).not.toHaveProperty('note');
      expect(dto.lines[0]).not.toHaveProperty('serialNumbers');
    });
  });

  describe('toConfirmResultDto', () => {
    it('assembles + parses the reference and pre-resolved repriceCandidates', () => {
      const dto = PurchasingMapper.toConfirmResultDto('SUP-2026-0001', [
        {
          productId: PRODUCT_ID,
          name: 'Screen Protector',
          averageCost: 102.5,
          current: { guestPrice: 1500, categoryPrices: [{ categoryId: CATEGORY_ID, categoryName: 'Gold', price: 1400 }] },
        },
      ]);

      expect(dto.reference).toBe('SUP-2026-0001');
      expect(dto.repriceCandidates).toHaveLength(1);
      expect(dto.repriceCandidates[0]?.averageCost).toBe(102.5);
    });
  });

  describe('toSupplierPaymentDto', () => {
    it('converts Decimal money fields and composes staffName', () => {
      const dto = PurchasingMapper.toSupplierPaymentDto(buildPaymentRow());

      expect(dto.amount).toBe(500);
      expect(dto.previousCredit).toBe(1000);
      expect(dto.newCredit).toBe(500);
      expect(dto.staffName).toBe('John Doe');
      expect(dto.paidAt).toBe(now.toISOString());
    });

    it('includes supplierInvoiceReference only when the payment is linked to an invoice', () => {
      const linked = PurchasingMapper.toSupplierPaymentDto(
        buildPaymentRow({ supplierInvoiceId: INVOICE_ID, supplierInvoice: { reference: 'SUP-2026-0001' } }),
      );
      expect(linked.supplierInvoiceReference).toBe('SUP-2026-0001');

      const onAccount = PurchasingMapper.toSupplierPaymentDto(buildPaymentRow());
      expect(onAccount).not.toHaveProperty('supplierInvoiceReference');
    });
  });

  describe('toSupplierDetailDto', () => {
    it('assembles the three sections + converts productHistory dates', () => {
      const supplierDto = PurchasingMapper.toSupplierDto(buildSupplierRow(), { invoiceCount: 1 });
      const invoiceDto = PurchasingMapper.toSupplierInvoiceDto(buildInvoiceRow());
      const paymentDto = PurchasingMapper.toSupplierPaymentDto(buildPaymentRow());

      const dto = PurchasingMapper.toSupplierDetailDto(supplierDto, [invoiceDto], [paymentDto], [
        { productId: PRODUCT_ID, productName: 'Screen Protector', totalQuantity: 10, lastPurchaseAt: now },
      ]);

      expect(dto.supplier).toEqual(supplierDto);
      expect(dto.invoices).toEqual([invoiceDto]);
      expect(dto.payments).toEqual([paymentDto]);
      expect(dto.productHistory[0]?.lastPurchaseAt).toBe(now.toISOString());
    });
  });

  describe('toSupplierStatsDto', () => {
    it('assembles + parses the three counters', () => {
      const dto = PurchasingMapper.toSupplierStatsDto({ totalSuppliers: 5, totalCredit: -200, totalInvoiced: 10000 });
      expect(dto).toEqual({ totalSuppliers: 5, totalCredit: -200, totalInvoiced: 10000 });
    });
  });
});

import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import type { ClientPayment, Invoice, InvoiceLine, Staff } from '@prisma/client';
import { BillingMapper, type ClientPaymentRow, type InvoiceRow } from '../../../../src/modules/billing/billing.mapper';

const now = new Date('2026-01-01T00:00:00.000Z');
const issuedAt = new Date('2026-01-02T10:30:00.000Z');
const dueDate = new Date('2026-02-01T00:00:00.000Z');

const INVOICE_ID = '11111111-1111-4111-8111-111111111111';
const LINE_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const POS_CLIENT_ID = '44444444-4444-4444-8444-444444444444';

const buildStaff = (overrides: Partial<Pick<Staff, 'firstName' | 'lastName'>> = {}) => ({
  firstName: 'Amina',
  lastName: 'Belkacem',
  ...overrides,
});

const buildLineRow = (overrides: Partial<InvoiceLine> = {}): InvoiceLine => ({
  id: LINE_ID,
  invoiceId: INVOICE_ID,
  label: 'Screen Protector',
  quantity: 2,
  unitPrice: new Prisma.Decimal(1000),
  costSnapshot: new Prisma.Decimal(400),
  profit: new Prisma.Decimal(1600),
  lineTotal: new Prisma.Decimal(2000),
  serialNumbers: null,
  ...overrides,
});

const buildInvoiceRow = (overrides: Partial<Invoice> = {}, lines: InvoiceLine[] = [buildLineRow()]): InvoiceRow => ({
  id: INVOICE_ID,
  number: 'FAC-2026-0001',
  posClientId: null,
  sourceType: 'SALE',
  sourceId: 'sale-1',
  status: 'ISSUED',
  clientNameSnapshot: 'Walk-in Customer',
  clientAddressSnapshot: null,
  totalAmount: new Prisma.Decimal(2000),
  paidAmount: new Prisma.Decimal(2000),
  previousCredit: new Prisma.Decimal(0),
  newCredit: new Prisma.Decimal(0),
  totalCost: new Prisma.Decimal(400),
  totalProfit: new Prisma.Decimal(1600),
  issuedAt,
  dueDate: null,
  staffId: STAFF_ID,
  createdAt: now,
  updatedAt: now,
  staff: buildStaff(),
  lines,
  ...overrides,
});

describe('BillingMapper.toInvoiceDto', () => {
  it('client audience strips totalCost/totalProfit and line costSnapshot/profit/currentAverageCost', () => {
    const dto = BillingMapper.toInvoiceDto(buildInvoiceRow(), {
      audience: 'client',
      sourceReference: 'SAL-2026-0001',
      currentAverageCostByLineId: new Map([[LINE_ID, 950]]),
    });

    expect(dto).not.toHaveProperty('totalCost');
    expect(dto).not.toHaveProperty('totalProfit');
    expect(dto.lines[0]).not.toHaveProperty('costSnapshot');
    expect(dto.lines[0]).not.toHaveProperty('profit');
    expect(dto.lines[0]).not.toHaveProperty('currentAverageCost');
  });

  it('staff audience strips the same fields as client', () => {
    const dto = BillingMapper.toInvoiceDto(buildInvoiceRow(), {
      audience: 'staff',
      sourceReference: 'SAL-2026-0001',
      currentAverageCostByLineId: new Map([[LINE_ID, 950]]),
    });

    expect(dto).not.toHaveProperty('totalCost');
    expect(dto.lines[0]).not.toHaveProperty('costSnapshot');
    expect(dto.lines[0]).not.toHaveProperty('currentAverageCost');
  });

  it('admin audience keeps totalCost/totalProfit/costSnapshot/profit and injects the live currentAverageCost', () => {
    const dto = BillingMapper.toInvoiceDto(buildInvoiceRow(), {
      audience: 'admin',
      sourceReference: 'SAL-2026-0001',
      currentAverageCostByLineId: new Map([[LINE_ID, 950]]),
    });

    expect(dto.totalCost).toBe(400);
    expect(dto.totalProfit).toBe(1600);
    expect(dto.lines[0]?.costSnapshot).toBe(400);
    expect(dto.lines[0]?.profit).toBe(1600);
    expect(dto.lines[0]?.currentAverageCost).toBe(950);
  });

  it('admin audience omits currentAverageCost gracefully when the line has no ctx entry', () => {
    const dto = BillingMapper.toInvoiceDto(buildInvoiceRow(), { audience: 'admin', sourceReference: 'SAL-2026-0001' });

    expect(dto.lines[0]).not.toHaveProperty('currentAverageCost');
  });

  it('sourceReference comes from ctx — Invoice has no such column to read', () => {
    const dto = BillingMapper.toInvoiceDto(buildInvoiceRow(), { audience: 'admin', sourceReference: 'SAL-2026-9999' });

    expect(dto.sourceReference).toBe('SAL-2026-9999');
  });

  it('converts Decimal money fields to plain numbers and Date fields to ISO/date-only', () => {
    const dto = BillingMapper.toInvoiceDto(buildInvoiceRow({ dueDate }), { audience: 'admin', sourceReference: 'SAL-2026-0001' });

    expect(dto.totalAmount).toBe(2000);
    expect(dto.paidAmount).toBe(2000);
    expect(dto.issuedAt).toBe(issuedAt.toISOString());
    expect(dto.dueDate).toBe('2026-02-01');
  });

  it('passes serialNumbers through as a plain string (unlike sales, no array conversion)', () => {
    const dto = BillingMapper.toInvoiceDto(
      buildInvoiceRow({}, [buildLineRow({ serialNumbers: 'SN-1,SN-2' })]),
      { audience: 'admin', sourceReference: 'SAL-2026-0001' },
    );

    expect(dto.lines[0]?.serialNumbers).toBe('SN-1,SN-2');
  });

  it('never throws on a valid row (conformance guard)', () => {
    for (const audience of ['client', 'staff', 'admin'] as const) {
      expect(() => BillingMapper.toInvoiceDto(buildInvoiceRow(), { audience, sourceReference: 'SAL-2026-0001' })).not.toThrow();
    }
  });
});

describe('BillingMapper.toClientPaymentDto', () => {
  const buildPaymentRow = (overrides: Partial<ClientPayment> = {}): ClientPaymentRow => ({
    id: 'payment-1',
    reference: 'REG-2026-0001',
    posClientId: POS_CLIENT_ID,
    invoiceId: null,
    amount: new Prisma.Decimal(500),
    previousCredit: new Prisma.Decimal(1000),
    newCredit: new Prisma.Decimal(500),
    paidAt: now,
    staffId: STAFF_ID,
    posClient: { name: 'Karim Store' },
    invoice: null,
    staff: buildStaff(),
    ...overrides,
  });

  it('includes invoiceNumber only when the payment is linked to an invoice', () => {
    const onAccount = BillingMapper.toClientPaymentDto(buildPaymentRow());
    expect(onAccount).not.toHaveProperty('invoiceNumber');

    const linked = BillingMapper.toClientPaymentDto(buildPaymentRow({ invoice: { number: 'FAC-2026-0001' } } as never));
    expect(linked.invoiceNumber).toBe('FAC-2026-0001');
  });

  it('converts Decimal money fields to numbers and paidAt to ISO', () => {
    const dto = BillingMapper.toClientPaymentDto(buildPaymentRow());

    expect(dto.amount).toBe(500);
    expect(dto.previousCredit).toBe(1000);
    expect(dto.newCredit).toBe(500);
    expect(dto.paidAt).toBe(now.toISOString());
    expect(dto.posClientName).toBe('Karim Store');
  });

  it('never throws on a valid row (conformance guard)', () => {
    expect(() => BillingMapper.toClientPaymentDto(buildPaymentRow())).not.toThrow();
  });
});

describe('BillingMapper.toInvoicePersistence', () => {
  it('builds an ISSUED create-input with optional fields only when present', () => {
    const bare = BillingMapper.toInvoicePersistence({
      number: 'FAC-2026-0001',
      sourceType: 'SALE' as never,
      sourceId: 'sale-1',
      clientNameSnapshot: 'Walk-in Customer',
      totalAmount: 2000,
      paidAmount: 2000,
      totalCost: 400,
      totalProfit: 1600,
      staffId: STAFF_ID,
      lines: [{ label: 'Screen Protector', quantity: 2, unitPrice: 1000, costSnapshot: 400, profit: 1600, lineTotal: 2000 }],
    });

    expect(bare.status).toBe('ISSUED');
    expect(bare).not.toHaveProperty('posClientId');
    expect(bare).not.toHaveProperty('clientAddressSnapshot');
    expect(bare).not.toHaveProperty('previousCredit');
    const lines = bare.lines as { create: { serialNumbers?: string }[] };
    expect(lines.create[0]).not.toHaveProperty('serialNumbers');

    const full = BillingMapper.toInvoicePersistence({
      number: 'FAC-2026-0002',
      posClientId: POS_CLIENT_ID,
      sourceType: 'SALE' as never,
      sourceId: 'sale-2',
      clientNameSnapshot: 'Karim Store',
      clientAddressSnapshot: '12 Rue de la Paix',
      totalAmount: 2000,
      paidAmount: 1000,
      previousCredit: 0,
      newCredit: 1000,
      totalCost: 400,
      totalProfit: 1600,
      staffId: STAFF_ID,
      lines: [
        { label: 'Screen Protector', quantity: 2, unitPrice: 1000, costSnapshot: 400, profit: 1600, lineTotal: 2000, serialNumbers: 'SN-1' },
      ],
    });

    expect(full.posClientId).toBe(POS_CLIENT_ID);
    expect(full.clientAddressSnapshot).toBe('12 Rue de la Paix');
    expect(full.previousCredit).toBe(0);
    expect(full.newCredit).toBe(1000);
    const fullLines = full.lines as { create: { serialNumbers?: string }[] };
    expect(fullLines.create[0]?.serialNumbers).toBe('SN-1');
  });
});

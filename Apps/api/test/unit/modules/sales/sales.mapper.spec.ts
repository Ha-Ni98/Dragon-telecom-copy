import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import type { PosClient, Sale, SaleLine, Staff } from '@prisma/client';
import { SalesMapper, type SaleRow } from '../../../../src/modules/sales/sales.mapper';
import { createSaleDraftPayload } from '../../../data/sale-draft.factory';

const now = new Date('2026-01-01T00:00:00.000Z');
const soldAt = new Date('2026-01-02T10:30:00.000Z');

const SALE_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const POS_CLIENT_ID = '44444444-4444-4444-8444-444444444444';
const SALE_LINE_ID = '55555555-5555-4555-8555-555555555555';

const buildStaff = (overrides: Partial<Pick<Staff, 'firstName' | 'lastName'>> = {}) => ({
  firstName: 'Amina',
  lastName: 'Belkacem',
  ...overrides,
});

const buildLineRow = (overrides: Partial<SaleLine> = {}): SaleLine => ({
  id: SALE_LINE_ID,
  saleId: SALE_ID,
  productId: PRODUCT_ID,
  productNameSnapshot: 'Screen Protector',
  quantity: 2,
  resolvedPrice: new Prisma.Decimal(900),
  unitPrice: new Prisma.Decimal(1000),
  costOfGoods: new Prisma.Decimal(400),
  profit: new Prisma.Decimal(1600),
  lineTotal: new Prisma.Decimal(2000),
  serialNumbers: null,
  ...overrides,
});

const buildSaleRow = (
  overrides: Partial<Sale> = {},
  lines: SaleLine[] = [buildLineRow()],
  posClient: Pick<PosClient, 'name'> | null = null,
): SaleRow => ({
  id: SALE_ID,
  reference: 'SAL-2026-0001',
  posClientId: null,
  origin: 'POS',
  status: 'COMPLETED',
  subtotal: new Prisma.Decimal(2000),
  discountAmount: new Prisma.Decimal(0),
  totalAmount: new Prisma.Decimal(2000),
  paidAmount: new Prisma.Decimal(2000),
  previousCredit: new Prisma.Decimal(0),
  newCredit: new Prisma.Decimal(0),
  totalCost: new Prisma.Decimal(400),
  totalProfit: new Prisma.Decimal(1600),
  soldAt,
  staffId: STAFF_ID,
  note: null,
  createdAt: now,
  updatedAt: now,
  posClient,
  staff: buildStaff(),
  lines,
  ...overrides,
});

describe('SalesMapper.toSaleDto', () => {
  it('staff mapping (includeMargins:false) omits costOfGoods/profit/totalCost/totalProfit', () => {
    const dto = SalesMapper.toSaleDto(buildSaleRow(), { includeMargins: false });

    expect(dto).not.toHaveProperty('totalCost');
    expect(dto).not.toHaveProperty('totalProfit');
    expect(dto.lines[0]).not.toHaveProperty('costOfGoods');
    expect(dto.lines[0]).not.toHaveProperty('profit');
  });

  it('admin mapping (includeMargins:true) keeps costOfGoods/profit/totalCost/totalProfit', () => {
    const dto = SalesMapper.toSaleDto(buildSaleRow(), { includeMargins: true });

    expect(dto.totalCost).toBe(400);
    expect(dto.totalProfit).toBe(1600);
    expect(dto.lines[0]?.costOfGoods).toBe(400);
    expect(dto.lines[0]?.profit).toBe(1600);
  });

  it('converts Decimal money fields to plain numbers', () => {
    const dto = SalesMapper.toSaleDto(buildSaleRow(), { includeMargins: true });

    expect(dto.subtotal).toBe(2000);
    expect(dto.totalAmount).toBe(2000);
    expect(dto.paidAmount).toBe(2000);
    expect(dto.lines[0]?.resolvedPrice).toBe(900);
    expect(dto.lines[0]?.unitPrice).toBe(1000);
  });

  it('converts soldAt to an ISO string, and omits it entirely for a still-DRAFT sale', () => {
    const confirmed = SalesMapper.toSaleDto(buildSaleRow(), { includeMargins: false });
    expect(confirmed.soldAt).toBe(soldAt.toISOString());

    const draft = SalesMapper.toSaleDto(buildSaleRow({ status: 'DRAFT', soldAt: null }), { includeMargins: false });
    expect(draft).not.toHaveProperty('soldAt');
  });

  it('surfaces both resolvedPrice and unitPrice so a price override is measurable', () => {
    const dto = SalesMapper.toSaleDto(buildSaleRow(), { includeMargins: false });

    expect(dto.lines[0]?.resolvedPrice).toBe(900);
    expect(dto.lines[0]?.unitPrice).toBe(1000);
    expect(dto.lines[0]?.unitPrice).not.toBe(dto.lines[0]?.resolvedPrice);
  });

  it('joins posClientName from the joined PosClient row when linked', () => {
    const dto = SalesMapper.toSaleDto(
      buildSaleRow({ posClientId: POS_CLIENT_ID }, undefined, { name: 'Karim Store' }),
      { includeMargins: false },
    );

    expect(dto.posClientId).toBe(POS_CLIENT_ID);
    expect(dto.posClientName).toBe('Karim Store');
  });

  it('parses a comma-joined serialNumbers column back into an array', () => {
    const dto = SalesMapper.toSaleDto(
      buildSaleRow({}, [buildLineRow({ serialNumbers: 'SN-1,SN-2' })]),
      { includeMargins: false },
    );

    expect(dto.lines[0]?.serialNumbers).toEqual(['SN-1', 'SN-2']);
  });

  it('omits serialNumbers entirely when the column is null', () => {
    const dto = SalesMapper.toSaleDto(buildSaleRow(), { includeMargins: false });

    expect(dto.lines[0]).not.toHaveProperty('serialNumbers');
  });

  it('exposes SaleLine.id as a valid uuid (audit fix A4 — the returns screen\'s line identifier)', () => {
    const dto = SalesMapper.toSaleDto(buildSaleRow(), { includeMargins: false });

    expect(dto.lines[0]?.id).toBe(SALE_LINE_ID);
    expect(dto.lines[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('never throws on a valid row (conformance guard)', () => {
    expect(() => SalesMapper.toSaleDto(buildSaleRow(), { includeMargins: true })).not.toThrow();
    expect(() => SalesMapper.toSaleDto(buildSaleRow(), { includeMargins: false })).not.toThrow();
  });
});

describe('SalesMapper.toReceiptDto', () => {
  it('never carries cost/profit fields — customer-facing only', () => {
    const dto = SalesMapper.toReceiptDto(buildSaleRow());

    expect(dto).not.toHaveProperty('totalCost');
    expect(dto).not.toHaveProperty('totalProfit');
    expect(dto.lines[0]).not.toHaveProperty('costOfGoods');
    expect(dto.lines[0]).not.toHaveProperty('profit');
    expect(dto.lines[0]).not.toHaveProperty('resolvedPrice');
  });

  it('derives grandTotal as total + previousCredit', () => {
    const dto = SalesMapper.toReceiptDto(
      buildSaleRow({ totalAmount: new Prisma.Decimal(2000), previousCredit: new Prisma.Decimal(500) }),
    );

    expect(dto.total).toBe(2000);
    expect(dto.previousCredit).toBe(500);
    expect(dto.grandTotal).toBe(2500);
  });

  it('defaults previousCredit/newCredit to 0 when the columns are null', () => {
    const dto = SalesMapper.toReceiptDto(buildSaleRow({ previousCredit: null, newCredit: null }));

    expect(dto.previousCredit).toBe(0);
    expect(dto.newCredit).toBe(0);
    expect(dto.grandTotal).toBe(dto.total);
  });

  it('never throws on a valid row (conformance guard)', () => {
    expect(() => SalesMapper.toReceiptDto(buildSaleRow())).not.toThrow();
  });
});

describe('SalesMapper.toPersistenceDraft', () => {
  const ctx = { staffId: STAFF_ID, reference: 'DRAFT-PLACEHOLDER', productNames: new Map([[PRODUCT_ID, 'Screen Protector']]) };

  it('builds a DRAFT create-input with resolvedPrice at 0 and lineTotal as a preview', () => {
    const cmd = createSaleDraftPayload({ lines: [{ productId: PRODUCT_ID, quantity: 3, unitPrice: 500 }] });

    const input = SalesMapper.toPersistenceDraft(cmd, ctx);

    expect(input.status).toBe('DRAFT');
    expect(input.origin).toBe('POS');
    expect(input.staffId).toBe(STAFF_ID);
    expect(input.reference).toBe('DRAFT-PLACEHOLDER');
    const lines = input.lines as { create: { resolvedPrice: number; unitPrice: number; lineTotal: number; productNameSnapshot: string }[] };
    expect(lines.create[0]?.resolvedPrice).toBe(0);
    expect(lines.create[0]?.unitPrice).toBe(500);
    expect(lines.create[0]?.lineTotal).toBe(1500);
    expect(lines.create[0]?.productNameSnapshot).toBe('Screen Protector');
  });

  it('falls back to an empty productNameSnapshot when the id is not in ctx.productNames', () => {
    const cmd = createSaleDraftPayload({
      lines: [{ productId: '99999999-9999-4999-8999-999999999999', quantity: 1, unitPrice: 100 }],
    });

    const input = SalesMapper.toPersistenceDraft(cmd, ctx);

    const lines = input.lines as { create: { productNameSnapshot: string }[] };
    expect(lines.create[0]?.productNameSnapshot).toBe('');
  });

  it('serializes a serialNumbers array into a comma-joined string', () => {
    const cmd = createSaleDraftPayload({
      lines: [{ productId: PRODUCT_ID, quantity: 1, unitPrice: 100, serialNumbers: ['SN-A', 'SN-B'] }],
    });

    const input = SalesMapper.toPersistenceDraft(cmd, ctx);

    const lines = input.lines as { create: { serialNumbers?: string }[] };
    expect(lines.create[0]?.serialNumbers).toBe('SN-A,SN-B');
  });

  it('includes posClientId/discountAmount/note only when present on the command', () => {
    const bare = SalesMapper.toPersistenceDraft(createSaleDraftPayload(), ctx);
    expect(bare).not.toHaveProperty('posClientId');
    expect(bare).not.toHaveProperty('discountAmount');
    expect(bare).not.toHaveProperty('note');

    const full = SalesMapper.toPersistenceDraft(
      createSaleDraftPayload({ posClientId: POS_CLIENT_ID, discountAmount: 50, note: 'gift wrap' }),
      ctx,
    );
    expect(full.posClientId).toBe(POS_CLIENT_ID);
    expect(full.discountAmount).toBe(50);
    expect(full.note).toBe('gift wrap');
  });
});

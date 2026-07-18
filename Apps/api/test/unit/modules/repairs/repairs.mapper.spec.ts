import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { ReportedIssue } from '@dragon-telecom/contract';
import { RepairsMapper } from '../../../../src/modules/repairs/repairs.mapper';
import { makeRepair } from '../../../data/repair.factory';
import { makeCreateRepairCommand } from '../../../data/create-repair.factory';
import { makeRepairPart } from '../../../data/repair-part.factory';

const now = new Date('2026-01-02T00:00:00.000Z');
const intakeAt = new Date('2026-01-01T00:00:00.000Z'); // exactly 24h before `now`

const BRAND_ID = '11111111-1111-4111-8111-111111111111';
const MODEL_ID = '22222222-2222-4222-8222-222222222222';
const TECHNICIAN_ID = '33333333-3333-4333-8333-333333333333';
const STAFF_ID = '44444444-4444-4444-8444-444444444444';
const PRODUCT_ID = '55555555-5555-4555-8555-555555555555';
const PART_ID = '66666666-6666-4666-8666-666666666666';
const REPAIR_ID = '77777777-7777-4777-8777-777777777777';
const HISTORY_ID = '88888888-8888-4888-8888-888888888888';

const buildPartRow = (overrides: Record<string, unknown> = {}) => ({
  id: PART_ID,
  repairId: REPAIR_ID,
  productId: PRODUCT_ID,
  productNameSnapshot: 'Screen',
  quantity: 1,
  unitPrice: new Prisma.Decimal(500),
  costOfGoods: new Prisma.Decimal(200),
  profit: new Prisma.Decimal(300),
  lineTotal: new Prisma.Decimal(500),
  serialNumbers: null,
  ...overrides,
});

const buildHistoryRow = (overrides: Record<string, unknown> = {}) => ({
  id: HISTORY_ID,
  repairId: REPAIR_ID,
  fromStatus: 'INTAKE' as const,
  toStatus: 'INTAKE' as const,
  note: null,
  staffId: STAFF_ID,
  changedAt: intakeAt,
  staff: { firstName: 'Amina', lastName: 'Belkacem' },
  ...overrides,
});

describe('RepairsMapper.toRepairDto', () => {
  it('staff mapping (includeMargins:false) omits totalCost/totalProfit and part costOfGoods/profit', () => {
    const repair = makeRepair({ totalCost: new Prisma.Decimal(200), totalProfit: new Prisma.Decimal(300), parts: [buildPartRow()] });
    const dto = RepairsMapper.toRepairDto(repair, { includeMargins: false, now });

    expect(dto).not.toHaveProperty('totalCost');
    expect(dto).not.toHaveProperty('totalProfit');
    expect(dto.parts[0]).not.toHaveProperty('costOfGoods');
    expect(dto.parts[0]).not.toHaveProperty('profit');
  });

  it('admin mapping (includeMargins:true) keeps totalCost/totalProfit and part costOfGoods/profit when stored', () => {
    const repair = makeRepair({ totalCost: new Prisma.Decimal(200), totalProfit: new Prisma.Decimal(300), parts: [buildPartRow()] });
    const dto = RepairsMapper.toRepairDto(repair, { includeMargins: true, now });

    expect(dto.totalCost).toBe(200);
    expect(dto.totalProfit).toBe(300);
    expect(dto.parts[0]?.costOfGoods).toBe(200);
    expect(dto.parts[0]?.profit).toBe(300);
  });

  it('omits totalCost/totalProfit for admin too when the repair is not yet completed (columns null)', () => {
    const repair = makeRepair({ totalCost: null, totalProfit: null, parts: [buildPartRow({ costOfGoods: null, profit: null })] });
    const dto = RepairsMapper.toRepairDto(repair, { includeMargins: true, now });

    expect(dto).not.toHaveProperty('totalCost');
    expect(dto).not.toHaveProperty('totalProfit');
    expect(dto.parts[0]).not.toHaveProperty('costOfGoods');
    expect(dto.parts[0]).not.toHaveProperty('profit');
  });

  it('assembles device refs from brand/model/label/imei, each independently optional', () => {
    const full = RepairsMapper.toRepairDto(
      makeRepair({
        brandId: BRAND_ID,
        deviceModelId: MODEL_ID,
        deviceLabel: 'iPhone 12',
        deviceImei: '123456789012345',
        brand: { id: BRAND_ID, name: 'Apple' },
        deviceModel: { id: MODEL_ID, name: 'iPhone 12' },
      }),
      { includeMargins: false, now },
    );
    expect(full.device.brand).toEqual({ id: BRAND_ID, name: 'Apple' });
    expect(full.device.model).toEqual({ id: MODEL_ID, name: 'iPhone 12' });
    expect(full.device.label).toBe('iPhone 12');
    expect(full.device.imei).toBe('123456789012345');

    const bare = RepairsMapper.toRepairDto(makeRepair(), { includeMargins: false, now });
    expect(bare.device).not.toHaveProperty('brand');
    expect(bare.device).not.toHaveProperty('model');
    expect(bare.device).not.toHaveProperty('label');
    expect(bare.device).not.toHaveProperty('imei');
  });

  it('surfaces technician only when linked', () => {
    const withTech = RepairsMapper.toRepairDto(
      makeRepair({ technicianId: TECHNICIAN_ID, technician: { id: TECHNICIAN_ID, name: 'Yacine' } }),
      { includeMargins: false, now },
    );
    expect(withTech.technician).toEqual({ id: TECHNICIAN_ID, name: 'Yacine' });

    const without = RepairsMapper.toRepairDto(makeRepair(), { includeMargins: false, now });
    expect(without).not.toHaveProperty('technician');
  });

  it('casts reportedIssues to the ReportedIssue enum', () => {
    const dto = RepairsMapper.toRepairDto(makeRepair({ reportedIssues: ['charging', 'water-damage'] }), {
      includeMargins: false,
      now,
    });
    expect(dto.reportedIssues).toEqual([ReportedIssue.CHARGING, ReportedIssue.WATER_DAMAGE]);
  });

  it('derives ageHours from intakeAt vs. the supplied `now`', () => {
    const dto = RepairsMapper.toRepairDto(makeRepair({ intakeAt }), { includeMargins: false, now });
    expect(dto.ageHours).toBe(24);
  });

  it('joins staffName onto each history row from the joined Staff row, keeping the intake marker', () => {
    const dto = RepairsMapper.toRepairDto(makeRepair({ history: [buildHistoryRow()] }), { includeMargins: false, now });

    expect(dto.history).toHaveLength(1);
    expect(dto.history[0]?.fromStatus).toBe('INTAKE');
    expect(dto.history[0]?.toStatus).toBe('INTAKE');
    expect(dto.history[0]?.staffName).toBe('Amina Belkacem');
  });

  it('never throws on a valid row (conformance guard)', () => {
    const repair = makeRepair({ parts: [buildPartRow()], history: [buildHistoryRow()] });
    expect(() => RepairsMapper.toRepairDto(repair, { includeMargins: true, now })).not.toThrow();
    expect(() => RepairsMapper.toRepairDto(repair, { includeMargins: false, now })).not.toThrow();
  });
});

describe('RepairsMapper.toPersistenceIntake', () => {
  const ctx = { reference: 'REP-2026-0001', customerName: 'Karim Belkacem', customerPhone: '0555000000' };

  it('builds an INTAKE create-input with every total at 0', () => {
    const cmd = makeCreateRepairCommand();
    const input = RepairsMapper.toPersistenceIntake(cmd, ctx);

    expect(input.status).toBe('INTAKE');
    expect(input.reference).toBe('REP-2026-0001');
    expect(input.customerName).toBe('Karim Belkacem');
    expect(input.customerPhone).toBe('0555000000');
    expect(input.labourPrice).toBe(0);
    expect(input.partsTotal).toBe(0);
    expect(input.totalAmount).toBe(0);
    expect(input.paidAmount).toBe(0);
  });

  it('uses ctx.customerName/customerPhone rather than the command\'s own (prefill precedence)', () => {
    const cmd = makeCreateRepairCommand({ customerName: 'Ignored', customerPhone: '0000000000' });
    const input = RepairsMapper.toPersistenceIntake(cmd, ctx);

    expect(input.customerName).toBe('Karim Belkacem');
    expect(input.customerPhone).toBe('0555000000');
  });

  it('includes optional device/brand/technician fields only when present on the command', () => {
    const bare = RepairsMapper.toPersistenceIntake(makeCreateRepairCommand(), ctx);
    expect(bare).not.toHaveProperty('brandId');
    expect(bare).not.toHaveProperty('deviceModelId');
    expect(bare).not.toHaveProperty('technicianId');

    const full = RepairsMapper.toPersistenceIntake(
      makeCreateRepairCommand({ brandId: BRAND_ID, deviceModelId: MODEL_ID, technicianId: TECHNICIAN_ID }),
      ctx,
    );
    expect(full.brandId).toBe(BRAND_ID);
    expect(full.deviceModelId).toBe(MODEL_ID);
    expect(full.technicianId).toBe(TECHNICIAN_ID);
  });
});

describe('RepairsMapper.toPartCreateInput', () => {
  it('computes lineTotal and passes serialNumbers through as a plain string', () => {
    const cmd = makeRepairPart({ productId: PRODUCT_ID, quantity: 3, unitPrice: 200, serialNumbers: 'SN-123' });
    const input = RepairsMapper.toPartCreateInput(cmd, { productName: 'Screen' });

    expect(input.productNameSnapshot).toBe('Screen');
    expect(input.lineTotal).toBe(600);
    expect(input.serialNumbers).toBe('SN-123');
  });

  it('omits serialNumbers when absent', () => {
    const input = RepairsMapper.toPartCreateInput(makeRepairPart(), { productName: 'Screen' });
    expect(input).not.toHaveProperty('serialNumbers');
  });
});

describe('RepairsMapper.ageHours', () => {
  it('computes elapsed hours between two dates', () => {
    expect(RepairsMapper.ageHours(intakeAt, now)).toBe(24);
  });
});

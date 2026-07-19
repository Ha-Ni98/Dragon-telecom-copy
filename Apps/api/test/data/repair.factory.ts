import { faker } from '@faker-js/faker';
import { Prisma } from '@prisma/client';
import { RepairStatus } from '@dragon-telecom/contract';
import { prisma } from '../../src/common/db/prisma';
import type { RepairRow } from '../../src/modules/repairs/repairs.mapper';

const DEFAULT_INTAKE_AT = new Date('2026-01-01T00:00:00.000Z');

// Plain RepairRow builder — reused across the mapper spec (Sprint 4) and the service spec
// (Sprint 5, mocking prisma.repair.findUnique/update), same "one builder, both layers"
// precedent order.factory.ts established.
export const makeRepair = (overrides: Partial<RepairRow> = {}): RepairRow => {
  const suffix = faker.string.alphanumeric(8).toUpperCase();
  return {
    id: faker.string.uuid(),
    reference: `REP-${suffix}`,
    posClientId: null,
    customerName: faker.person.fullName(),
    customerPhone: faker.string.numeric(10),
    brandId: null,
    deviceModelId: null,
    deviceLabel: null,
    deviceImei: null,
    reportedIssues: ['charging'],
    reportedIssueOther: null,
    diagnosis: null,
    status: RepairStatus.INTAKE,
    technicianId: null,
    labourPrice: new Prisma.Decimal(0),
    partsTotal: new Prisma.Decimal(0),
    totalAmount: new Prisma.Decimal(0),
    paidAmount: new Prisma.Decimal(0),
    totalCost: null,
    totalProfit: null,
    intakeAt: DEFAULT_INTAKE_AT,
    completedAt: null,
    pickedUpAt: null,
    saleId: null,
    createdAt: DEFAULT_INTAKE_AT,
    updatedAt: DEFAULT_INTAKE_AT,
    brand: null,
    deviceModel: null,
    technician: null,
    parts: [],
    history: [],
    ...overrides,
  };
};

export type SeedRepairOptions = {
  posClientId?: string;
  customerName?: string;
  customerPhone?: string;
  brandId?: string;
  deviceModelId?: string;
  deviceLabel?: string;
  deviceImei?: string;
  reportedIssues?: string[];
  reportedIssueOther?: string;
  diagnosis?: string;
  status?: RepairStatus;
  technicianId?: string;
  labourPrice?: number;
  partsTotal?: number;
  totalAmount?: number;
  paidAmount?: number;
  totalCost?: number;
  totalProfit?: number;
  reference?: string;
};

// Real DB row — no required FK at all (every relation on Repair is optional) — for later
// integration sprints and any service spec that prefers a genuinely persisted row.
export const seedRepair = async (options: SeedRepairOptions = {}) => {
  const suffix = faker.string.alphanumeric(8).toUpperCase();
  return prisma.repair.create({
    data: {
      reference: options.reference ?? `REP-${suffix}`,
      ...(options.posClientId != null ? { posClientId: options.posClientId } : {}),
      customerName: options.customerName ?? faker.person.fullName(),
      customerPhone: options.customerPhone ?? faker.string.numeric(10),
      ...(options.brandId != null ? { brandId: options.brandId } : {}),
      ...(options.deviceModelId != null ? { deviceModelId: options.deviceModelId } : {}),
      ...(options.deviceLabel != null ? { deviceLabel: options.deviceLabel } : {}),
      ...(options.deviceImei != null ? { deviceImei: options.deviceImei } : {}),
      reportedIssues: options.reportedIssues ?? ['charging'],
      ...(options.reportedIssueOther != null ? { reportedIssueOther: options.reportedIssueOther } : {}),
      ...(options.diagnosis != null ? { diagnosis: options.diagnosis } : {}),
      status: options.status ?? RepairStatus.INTAKE,
      ...(options.technicianId != null ? { technicianId: options.technicianId } : {}),
      labourPrice: options.labourPrice ?? 0,
      partsTotal: options.partsTotal ?? 0,
      totalAmount: options.totalAmount ?? 0,
      paidAmount: options.paidAmount ?? 0,
      ...(options.totalCost != null ? { totalCost: options.totalCost } : {}),
      ...(options.totalProfit != null ? { totalProfit: options.totalProfit } : {}),
    },
  });
};

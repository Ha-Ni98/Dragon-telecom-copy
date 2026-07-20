import {
  RepairResponseSchema,
  RepairStatus,
  ReportedIssue,
  type RepairDto,
} from "@dragon-telecom/contract";
import { mockProductWithPricing, mockBrand, mockModel } from "./catalog.mock";

export const mockRepair: RepairDto = RepairResponseSchema.parse({
  id: "60000000-0000-4000-8000-000000000001",
  reference: "REP-0001",
  status: RepairStatus.PROCESSING,
  customerName: "Karim Bensaid",
  customerPhone: "0555000222",
  posClientId: "50000000-0000-4000-8000-000000000002",
  device: {
    brand: { id: mockBrand.id, name: mockBrand.name },
    model: { id: mockModel.id, name: mockModel.name },
    imei: "354123456789012",
  },
  reportedIssues: [ReportedIssue.DISPLAY, ReportedIssue.BATTERY],
  diagnosis: "Cracked screen, battery swollen",
  technician: { id: "60000000-0000-4000-8000-000000000002", name: "Yacine Meziane" },
  labourPrice: 2_000,
  partsTotal: 4_500,
  totalAmount: 6_500,
  paidAmount: 0,
  totalCost: 3_000,
  totalProfit: 3_500,
  intakeAt: "2026-07-15T09:00:00.000Z",
  ageHours: 96,
  parts: [
    {
      id: "60000000-0000-4000-8000-000000000003",
      productId: mockProductWithPricing.id,
      productName: mockProductWithPricing.name,
      quantity: 1,
      unitPrice: 4_500,
      costOfGoods: 2_700,
      profit: 1_800,
      lineTotal: 4_500,
    },
  ],
  history: [
    {
      fromStatus: RepairStatus.INTAKE,
      toStatus: RepairStatus.PROCESSING,
      staffName: "Sara Haddad",
      changedAt: "2026-07-15T09:30:00.000Z",
    },
  ],
});

export const mockRepairs: RepairDto[] = [mockRepair];

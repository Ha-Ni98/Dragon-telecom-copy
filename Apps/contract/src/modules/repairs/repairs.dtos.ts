import { z } from 'zod';
import { RepairStatus, ReportedIssue } from './repairs.enums';

// device.brand/model are inlined {id;name} refs (repairs has no catalog dependency in
// the plan). totalCost/totalProfit and part costOfGoods/profit are mapping-gated
// (admin-only), modelled .optional().
export const RepairResponseSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  status: z.enum(RepairStatus),
  customerName: z.string(),
  customerPhone: z.string(),
  posClientId: z.uuid().optional(),
  device: z.object({
    brand: z.object({ id: z.uuid(), name: z.string() }).optional(),
    model: z.object({ id: z.uuid(), name: z.string() }).optional(),
    label: z.string().optional(),
    imei: z.string().optional(),
  }),
  reportedIssues: z.array(z.enum(ReportedIssue)),
  reportedIssueOther: z.string().optional(),
  diagnosis: z.string().optional(),
  technician: z.object({ id: z.uuid(), name: z.string() }).optional(),
  labourPrice: z.number(),
  partsTotal: z.number(),
  totalAmount: z.number(),
  paidAmount: z.number(),
  // S30 — cash given back at CANCELLED/RETURNED; paidAmount is already net of it.
  refundedAmount: z.number(),
  totalCost: z.number().optional(),
  totalProfit: z.number().optional(),
  intakeAt: z.iso.datetime(),
  completedAt: z.iso.datetime().optional(),
  pickedUpAt: z.iso.datetime().optional(),
  cancelledAt: z.iso.datetime().optional(), // S30
  returnedAt: z.iso.datetime().optional(), // S30
  ageHours: z.number(),
  // S13/D9 — the invoice issued at PICKED_UP. Absent before pickup and on cancelled repairs;
  // still present (now CANCELLED) on a returned repair (S30).
  invoiceNumber: z.string().optional(),
  // S13/D5 — the ledger rows taken for this repair (on-account before pickup, invoice-linked
  // after). Empty for a walk-in repair: no PosClient means no ledger row is possible, and the
  // repair's own paidAmount is the whole record.
  payments: z.array(
    z.object({
      id: z.uuid(),
      reference: z.string(),
      amount: z.number(),
      paidAt: z.iso.datetime(),
      invoiceId: z.uuid().optional(),
      // S30/Q1 — on a negative row, the reference of the payment it reverses.
      reversesReference: z.string().optional(),
    }),
  ),
  parts: z.array(
    z.object({
      id: z.uuid(),
      productId: z.uuid(),
      productName: z.string(),
      quantity: z.number().int(),
      unitPrice: z.number(),
      costOfGoods: z.number().optional(),
      profit: z.number().optional(),
      lineTotal: z.number(),
      serialNumbers: z.string().optional(),
      // S30 — absent until RETURNED; then whether this part went back on the shelf.
      restockedOnReturn: z.boolean().optional(),
    }),
  ),
  history: z.array(
    z.object({
      fromStatus: z.enum(RepairStatus),
      toStatus: z.enum(RepairStatus),
      note: z.string().optional(),
      staffName: z.string(),
      changedAt: z.iso.datetime(),
    }),
  ),
});
export type RepairDto = z.infer<typeof RepairResponseSchema>;

// S13/R1 — the admin Technicians tab. Counts per status plus revenue (Σ totalAmount over that
// technician's PICKED_UP repairs — the only status at which repair revenue is recognised, D8).
export const TechnicianRepairStatsResponseSchema = z.object({
  technicianId: z.uuid(),
  technicianName: z.string(),
  isEnabled: z.boolean(),
  totalRepairs: z.number().int(),
  intakeCount: z.number().int(),
  processingCount: z.number().int(),
  completedCount: z.number().int(),
  pickedUpCount: z.number().int(),
  cancelledCount: z.number().int(),
  returnedCount: z.number().int(), // S30
  revenue: z.number(),
});
export type TechnicianRepairStatsDto = z.infer<typeof TechnicianRepairStatsResponseSchema>;

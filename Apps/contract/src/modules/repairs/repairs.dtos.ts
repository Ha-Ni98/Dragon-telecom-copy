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
  totalCost: z.number().optional(),
  totalProfit: z.number().optional(),
  intakeAt: z.iso.datetime(),
  completedAt: z.iso.datetime().optional(),
  pickedUpAt: z.iso.datetime().optional(),
  ageHours: z.number(),
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

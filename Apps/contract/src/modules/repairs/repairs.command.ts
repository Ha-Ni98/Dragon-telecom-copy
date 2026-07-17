import { z } from 'zod';
import { RepairStatus, ReportedIssue } from './repairs.enums';

export const CreateRepairSchema = z.object({
  posClientId: z.uuid().optional(),
  customerName: z.string(),
  customerPhone: z.string(),
  brandId: z.uuid().optional(),
  deviceModelId: z.uuid().optional(),
  deviceLabel: z.string().optional(),
  deviceImei: z.string().optional(),
  reportedIssues: z.array(z.enum(ReportedIssue)).min(1),
  reportedIssueOther: z.string().optional(),
  technicianId: z.uuid().optional(),
});
export type CreateRepairCommand = z.infer<typeof CreateRepairSchema>;

// Route note lists "diagnosis?, labourPrice, technicianId" — all kept optional, as this
// is a PATCH (partial update).
export const UpdateRepairSchema = z.object({
  diagnosis: z.string().optional(),
  labourPrice: z.number().min(0).optional(),
  technicianId: z.uuid().optional(),
});
export type UpdateRepairCommand = z.infer<typeof UpdateRepairSchema>;

export const AddRepairPartSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  serialNumbers: z.string().optional(),
});
export type AddRepairPartCommand = z.infer<typeof AddRepairPartSchema>;

export const RepairStatusSchema = z.object({
  toStatus: z.enum(RepairStatus),
  note: z.string().optional(),
  paidAmount: z.number().min(0).optional(),
  consumedPartReturns: z
    .array(z.object({ partId: z.uuid(), restock: z.boolean() }))
    .optional(),
});
export type RepairStatusCommand = z.infer<typeof RepairStatusSchema>;

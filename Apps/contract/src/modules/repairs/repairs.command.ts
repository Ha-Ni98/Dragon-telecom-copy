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

// S13/D8 — `paymentAmount` is the money captured AT this transition (a DELTA, added to the
// repair's cumulative paidAmount), not the repair's new total. Renamed from `paidAmount`, which
// was an absolute overwrite and cannot survive D5's cumulative payments.
// `refundAmount` is the cash returned when cancelling a repair that already collected money
// (D6 — recorded as a negative-amount ClientPayment row for a known client).
// `consumedPartReturns` is GONE: under D8 nothing is ever consumed before PICKED_UP, and cancel
// is unreachable from PICKED_UP, so no consumed part can exist at cancel time.
// S30 — `toStatus: RETURNED` is rejected here; a return goes through ReturnRepairSchema below.
export const RepairStatusSchema = z.object({
  toStatus: z.enum(RepairStatus),
  note: z.string().optional(),
  paymentAmount: z.number().min(0).optional(),
  refundAmount: z.number().min(0).optional(),
});
export type RepairStatusCommand = z.infer<typeof RepairStatusSchema>;

// S13/D5 — a payment captured at INTAKE/PROCESSING/COMPLETED, before the invoice exists. For a
// known POS client this becomes an on-account ClientPayment row (null invoiceId, repairId set);
// for a walk-in it only moves the repair's own paidAmount.
export const RecordRepairPaymentSchema = z.object({
  amount: z.number().positive(),
});
export type RecordRepairPaymentCommand = z.infer<typeof RecordRepairPaymentSchema>;

// S30 — return a PICKED_UP repair (→ RETURNED, terminal). `restockPartIds` lists the parts that
// go back on the shelf (REPAIR_RETURN at their consumed cost); a part not listed produces no
// movement (fitted then removed, not resellable). No refund field: every payment is reversed in
// full (owner decision Q4). `note` is the reason, written to the status history.
export const ReturnRepairSchema = z.object({
  restockPartIds: z.array(z.uuid()),
  note: z.string().optional(),
});
export type ReturnRepairCommand = z.infer<typeof ReturnRepairSchema>;

import { z } from "zod";
import { RepairStatus } from "@dragon-telecom/contract";
import type { RepairStatusCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to RepairStatusCommand (repairs.command.ts), plus one page-local field:
// `technicianId` isn't part of this command (it belongs to UpdateRepairCommand) but the
// PROCESSING transition requires one (ADM-13 §Forms: "technician for PROCESSING") — the
// component submits it via a separate `useUpdateRepair` call before the status PATCH, so it's
// carried here only to gate the single transition form and is omitted from the compile-time
// contract check below (mirrors change-password.schema.ts's `confirmPassword` precedent).
//
// `consumedPartIds` (ids of parts already consumed on this ticket, if any) drives the other
// refine: post-consumption CANCELLED requires an explicit restock choice per consumed part
// (ADM-13 §Interactions, "shows the explicit per-part restock choices").
export function repairStatusSchema(
  t: ReturnType<typeof useTranslation>["t"],
  consumedPartIds: string[] = [],
) {
  return z
    .object({
      toStatus: z.enum(RepairStatus),
      note: z.string().optional(),
      paidAmount: z.number().min(0, t("staff.repairs.statusDialog.paidAmountInvalid")).optional(),
      consumedPartReturns: z.array(z.object({ partId: z.uuid(), restock: z.boolean() })).optional(),
      technicianId: z.uuid().optional(),
    })
    .refine((d) => d.toStatus !== RepairStatus.PROCESSING || !!d.technicianId, {
      message: t("staff.repairs.statusDialog.technicianRequired"),
      path: ["technicianId"],
    })
    .refine((d) => d.toStatus !== RepairStatus.PICKED_UP || d.paidAmount !== undefined, {
      message: t("staff.repairs.statusDialog.paidAmountRequired"),
      path: ["paidAmount"],
    })
    .refine(
      (d) =>
        d.toStatus !== RepairStatus.CANCELLED ||
        consumedPartIds.length === 0 ||
        (d.consumedPartReturns?.length ?? 0) === consumedPartIds.length,
      {
        message: t("staff.repairs.statusDialog.consumedPartReturnsRequired"),
        path: ["consumedPartReturns"],
      },
    );
}

export type RepairStatusFormValues = z.infer<ReturnType<typeof repairStatusSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command. `technicianId` is omitted deliberately (see file header).
type AssertAssignable<T extends true> = T;
type _RepairStatusCommandCheck = AssertAssignable<
  Omit<RepairStatusFormValues, "technicianId"> extends RepairStatusCommand ? true : false
>;

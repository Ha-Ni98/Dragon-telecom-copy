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
// S13/D8 — `paymentAmount` (renamed from `paidAmount`) is the amount collected AT the PICKED_UP
// transition; `amountDue` (caller-supplied, = totalAmount − paidAmount so far) drives the "must
// settle the ticket" refine. `refundAmount` (D6) is offered on CANCELLED when money was already
// collected. `consumedPartIds`/`consumedPartReturns` are gone — nothing is ever consumed before
// PICKED_UP any more.
//
// z.coerce.number() (not `valueAsNumber: true`) — an empty numeric input with `valueAsNumber`
// resolves to NaN before zod ever sees it (report-S03.md's finding); z.coerce.number()'s input
// type is `unknown`, so this needs the 3-generic useForm<Input, unknown, Output> precedent
// (order-status.schema.ts, S10, is the most recent example of this exact fix).
export function repairStatusSchema(
  t: ReturnType<typeof useTranslation>["t"],
  opts: { amountDue: number },
) {
  return (
    z
      .object({
        toStatus: z.enum(RepairStatus),
        note: z.string().optional(),
        paymentAmount: z.coerce
          .number()
          .min(0, t("staff.repairs.statusDialog.paymentAmountInvalid"))
          .optional(),
        refundAmount: z.coerce
          .number()
          .min(0, t("staff.repairs.statusDialog.refundAmountInvalid"))
          .optional(),
        technicianId: z.uuid().optional(),
      })
      .refine((d) => d.toStatus !== RepairStatus.PROCESSING || !!d.technicianId, {
        message: t("staff.repairs.statusDialog.technicianRequired"),
        path: ["technicianId"],
      })
      // D8 — pickup must settle the ticket: the amount entered here plus what was already paid
      // must reach the total.
      .refine(
        (d) =>
          d.toStatus !== RepairStatus.PICKED_UP ||
          opts.amountDue <= 0 ||
          (d.paymentAmount ?? 0) > 0,
        {
          message: t("staff.repairs.statusDialog.paymentAmountRequired"),
          path: ["paymentAmount"],
        },
      )
  );
}

export type RepairStatusFormValues = z.infer<ReturnType<typeof repairStatusSchema>>;

// 3-generic form: useForm<RepairStatusInput, unknown, RepairStatusFormValues>().
export type RepairStatusInput = z.input<ReturnType<typeof repairStatusSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command. `technicianId` is omitted deliberately (see file header).
type AssertAssignable<T extends true> = T;
type _RepairStatusCommandCheck = AssertAssignable<
  Omit<RepairStatusFormValues, "technicianId"> extends RepairStatusCommand ? true : false
>;

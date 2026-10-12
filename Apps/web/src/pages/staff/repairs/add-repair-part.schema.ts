import { z } from "zod";
import type { AddRepairPartCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// S31 — the ticket drawer's staged parts list (picked via RepairPartPickerDialog, then edited,
// then reserved all at once by AddRepairPartsCommand). Shared by STF-07 and ADM-13.
// `productName`/`availableQuantity` are display and bound-checking aids captured at pick time;
// RepairPartsStaging strips them before the command is sent. The definitive bound is still the
// server's 409 INSUFFICIENT_STOCK — availability can change between pick and submit.
// z.coerce.number() (not `valueAsNumber: true`) — an empty numeric input with `valueAsNumber`
// resolves to NaN before zod ever sees it (report-S03.md's finding), so this uses the 3-generic
// useForm<Input, unknown, Output> precedent (repair-status.schema.ts).
function stagedPartSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .object({
      productId: z.uuid(),
      productName: z.string(),
      availableQuantity: z.number().int(),
      quantity: z.coerce.number().int().min(1, t("staff.repairs.addPart.quantityMin")),
      unitPrice: z.coerce.number().min(0, t("staff.repairs.addPart.unitPriceInvalid")),
      serialNumbers: z.string().optional(),
    })
    .refine((row) => row.quantity <= row.availableQuantity, {
      message: t("staff.repairs.addPart.quantityExceedsAvailable"),
      path: ["quantity"],
    });
}

export function addRepairPartsSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({ parts: z.array(stagedPartSchema(t)).min(1) });
}

export type AddRepairPartsFormValues = z.output<ReturnType<typeof addRepairPartsSchema>>;
export type AddRepairPartsFormInput = z.input<ReturnType<typeof addRepairPartsSchema>>;

// Compile-time guard — fails to compile if a staged row (minus its two display aids) drifts from
// the contract's per-part command.
type AssertAssignable<T extends true> = T;
type _AddRepairPartCommandCheck = AssertAssignable<
  Omit<
    AddRepairPartsFormValues["parts"][number],
    "productName" | "availableQuantity"
  > extends AddRepairPartCommand
    ? true
    : false
>;

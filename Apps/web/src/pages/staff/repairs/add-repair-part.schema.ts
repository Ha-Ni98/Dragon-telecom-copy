import { z } from "zod";
import type { AddRepairPartCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to AddRepairPartCommand (repairs.command.ts). Shared by STF-07 and ADM-13 (parts
// editor). `maxQuantity` is optional and only supplied when the product picker already knows
// the line's live available quantity (admin desktop search results carry it); the definitive
// bound is still the server's 409 INSUFFICIENT_STOCK (ADM-13 §Interactions).
export function addRepairPartSchema(
  t: ReturnType<typeof useTranslation>["t"],
  maxQuantity?: number,
) {
  const quantitySchema = z.number().int().min(1, t("staff.repairs.addPart.quantityMin"));
  return z.object({
    productId: z.uuid(),
    quantity:
      maxQuantity !== undefined
        ? quantitySchema.max(maxQuantity, t("staff.repairs.addPart.quantityExceedsAvailable"))
        : quantitySchema,
    unitPrice: z.number().min(0, t("staff.repairs.addPart.unitPriceInvalid")),
    serialNumbers: z.string().optional(),
  });
}

export type AddRepairPartFormValues = z.infer<ReturnType<typeof addRepairPartSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _AddRepairPartCommandCheck = AssertAssignable<
  AddRepairPartFormValues extends AddRepairPartCommand ? true : false
>;

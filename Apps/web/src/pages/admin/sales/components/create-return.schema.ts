import { z } from "zod";
import { ReturnType as SaleReturnType } from "@dragon-telecom/contract";
import type { CreateReturnCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to CreateReturnCommand (sales.command.ts). Admin-only (ADM-10 §Forms). Contract's
// `ReturnType` enum is aliased to avoid shadowing TypeScript's built-in `ReturnType<T>` utility
// used below. `lineBounds` maps saleLineId -> (sold − already returned) so each line's quantity
// can be bound locally ("per-line qty ≤ sold − already returned", ADM-10 §UI); the backend
// re-validates the same bound.
export function createReturnSchema(
  t: ReturnType<typeof useTranslation>["t"],
  lineBounds: Record<string, number>,
) {
  return z
    .object({
      saleId: z.uuid(),
      type: z.enum(SaleReturnType),
      reason: z.string().optional(),
      lines: z
        .array(
          z.object({
            saleLineId: z.uuid(),
            quantity: z.number().int().min(1, t("admin.sales.returnDialog.quantityMin")),
            restock: z.boolean(),
            refundAmount: z.number().min(0, t("admin.sales.returnDialog.refundAmountInvalid")),
          }),
        )
        .min(1, t("admin.sales.returnDialog.linesRequired")),
    })
    .superRefine((d, ctx) => {
      d.lines.forEach((line, index) => {
        const bound = lineBounds[line.saleLineId];
        if (bound !== undefined && line.quantity > bound) {
          ctx.addIssue({
            code: "custom",
            message: t("admin.sales.returnDialog.quantityExceedsRemaining"),
            path: ["lines", index, "quantity"],
          });
        }
      });
    });
}

export type CreateReturnFormValues = z.infer<ReturnType<typeof createReturnSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _CreateReturnCommandCheck = AssertAssignable<
  CreateReturnFormValues extends CreateReturnCommand ? true : false
>;

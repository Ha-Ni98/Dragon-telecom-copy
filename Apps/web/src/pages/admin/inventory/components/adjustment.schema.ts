import { z } from "zod";
import { AdjustmentReason } from "@dragon-telecom/contract";
import type { CreateAdjustmentCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to CreateAdjustmentCommand (inventory.command.ts). `unitCost` is required by the
// backend only for lines that raise stock (an IN movement) — the contract can't express that
// without knowing current system quantity, so this wrapper takes the stock snapshot the
// Adjustments tab already has loaded (`systemQuantityByProductId`, keyed by productId) and
// enforces "unitCost required whenever countedQuantity > current system quantity" client-side
// via `superRefine` (ADM-06 §4). `prices` (the optional reprice sub-form) is submitted as-is,
// no local refine needed beyond the contract's own `UpdatePricingSchema`.
export function adjustmentSchema(
  t: ReturnType<typeof useTranslation>["t"],
  systemQuantityByProductId: Record<string, number>,
) {
  return z
    .object({
      reason: z.enum(AdjustmentReason, { message: t("common.validation.selectRequired") }),
      note: z.string().optional(),
      lines: z
        .array(
          z.object({
            productId: z.uuid(),
            countedQuantity: z.number().int().min(0, t("common.validation.nonNegativeNumber")),
            unitCost: z.number().min(0, t("common.validation.nonNegativeNumber")).optional(),
          }),
        )
        .min(1, t("admin.inventory.adjustment.lineRequired")),
    })
    .superRefine((d, ctx) => {
      d.lines.forEach((line, index) => {
        const systemQuantity = systemQuantityByProductId[line.productId] ?? 0;
        const isIncrease = line.countedQuantity > systemQuantity;
        if (isIncrease && line.unitCost === undefined) {
          ctx.addIssue({
            code: "custom",
            message: t("admin.inventory.adjustment.unitCostRequiredForIncrease"),
            path: ["lines", index, "unitCost"],
          });
        }
      });
    });
}

export type AdjustmentFormValues = z.infer<ReturnType<typeof adjustmentSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _CreateAdjustmentCommandCheck = AssertAssignable<
  AdjustmentFormValues extends CreateAdjustmentCommand ? true : false
>;

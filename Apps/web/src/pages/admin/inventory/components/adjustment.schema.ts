import { z } from "zod";
import { AdjustmentReason } from "@dragon-telecom/contract";
import type { CreateAdjustmentCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to CreateAdjustmentCommand (inventory.command.ts). `unitCost` is required by the
// backend only for lines that raise stock (an IN movement) — the contract can't express that
// without knowing current system quantity, so this wrapper takes the stock snapshot the
// Adjustments tab already has loaded (`systemQuantityByProductId`, keyed by productId) and
// enforces "unitCost required whenever countedQuantity > current system quantity" client-side
// via `superRefine` (ADM-06 §4). The UI now pre-fills `unitCost` from the product's
// `avgStockPrice` whenever one exists (S4, D10) — this refine still fires for a never-stocked
// product (avgStockPrice 0, left blank) or a deliberately cleared field.
//
// S28 — the optional reprice sub-form ADM-06 always specified ("an optional collapsed reprice
// sub-form prefilled with current prices") is finally here. It is held as a DRAFT, not as the
// contract's `prices` shape: the draft keeps `enabled` plus per-category prices that may be
// blank, neither of which the command allows. `toCreateAdjustmentCommand` below maps draft →
// command at submit time, which is also where the old
// `AdjustmentFormValues extends CreateAdjustmentCommand` guard moved to — the mapper's return
// annotation now enforces the same thing, and enforces the mapping itself as well.
//
// `categoryPrices` is `.optional()` on purpose, not required: the reprice checkbox
// (adjustment-reprice-fields.tsx) can be ticked by the user before its async prefill effect has
// populated the per-category rows (the product's current prices haven't loaded yet), which would
// leave `reprice.categoryPrices` genuinely `undefined` in form state. Requiring the array made
// that a validation failure with no rendered error anywhere (reprice fields don't surface nested
// errors) — RHF's handleSubmit silently takes the invalid path, so Save appeared to do nothing.
// toCreateAdjustmentCommand defaults a missing array to `[]` below.
const repriceDraftSchema = z.object({
  enabled: z.boolean(),
  guestPrice: z.number().min(0).optional(),
  defaultSalePrice: z.number().min(0).optional(),
  categoryPrices: z
    .array(z.object({ categoryId: z.uuid(), price: z.number().min(0).optional() }))
    .optional(),
});

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
            reprice: repriceDraftSchema.optional(),
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

// Draft → contract command. `guestPrice: … ?? null` is deliberate and matches reprice-prompt.tsx:
// a blank guest-price field CLEARS the guest price (UpdatePricingCommand.guestPrice is
// `number | null | undefined`, and catalog's applyPricing treats each state differently).
// `defaultSalePrice` is omitted when blank, and blank category prices are dropped — applyPricing
// upserts, never deletes, so an omitted category keeps its existing price.
export function toCreateAdjustmentCommand(values: AdjustmentFormValues): CreateAdjustmentCommand {
  return {
    reason: values.reason,
    ...(values.note != null ? { note: values.note } : {}),
    lines: values.lines.map((line) => ({
      productId: line.productId,
      countedQuantity: line.countedQuantity,
      ...(line.unitCost != null ? { unitCost: line.unitCost } : {}),
      ...(line.reprice?.enabled
        ? {
            prices: {
              guestPrice: line.reprice.guestPrice ?? null,
              ...(line.reprice.defaultSalePrice != null
                ? { defaultSalePrice: line.reprice.defaultSalePrice }
                : {}),
              categoryPrices: (line.reprice.categoryPrices ?? [])
                .filter(
                  (entry): entry is { categoryId: string; price: number } => entry.price != null,
                )
                .map((entry) => ({ categoryId: entry.categoryId, price: entry.price })),
            },
          }
        : {}),
    })),
  };
}

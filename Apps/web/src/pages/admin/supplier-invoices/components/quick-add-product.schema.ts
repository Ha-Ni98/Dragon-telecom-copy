import { z } from "zod";
import type { CreateProductCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// ADM-08 quick-add-product dialog (S7 I5) — a minimal subset of CreateProductCommand
// (catalog.command.ts): a missing catalog entry never blocks a line (plan §Page 3). Rebuilt on
// ids (familyId/brandId/modelId), matching Add Product's own taxonomy pickers — each dropdown
// carries its own quick-add, exactly like AdminProductsAdd.tsx. `initialQuantity: 0` stays: the
// invoice's own confirm step is what actually moves stock in, and CreateProductCommand's own
// PRICING_REQUIRES_STOCK rule means a 0-quantity create must carry no pricing — which is why
// this dialog asks for none.
export function quickAddProductSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    familyId: z.uuid(t("common.validation.required")),
    brandId: z.uuid(t("common.validation.required")),
    modelId: z.uuid().optional(),
    name: z.string().min(1, t("common.validation.required")),
    initialQuantity: z.literal(0),
  });
}

export type QuickAddProductFormValues = z.infer<ReturnType<typeof quickAddProductSchema>>;

type AssertAssignable<T extends true> = T;
type _CreateProductCommandCheck = AssertAssignable<
  QuickAddProductFormValues extends CreateProductCommand ? true : false
>;

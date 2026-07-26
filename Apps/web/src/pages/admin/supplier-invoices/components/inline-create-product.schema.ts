import { z } from "zod";
import type { CreateProductCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// ADM-08 inline create-product dialog — a minimal subset of CreateProductCommand
// (catalog.command.ts): a missing catalog entry never blocks a line (plan §Page 3). Always
// creates against a **new** family/brand name (the invoice line editor's product picker
// already covers "pick an existing product" — this dialog is for the "doesn't exist yet"
// case only) and `initialQuantity: 0` (the invoice's own confirm step is what actually moves
// stock in — this dialog only registers the catalog entry, matching CreateProductCommand's own
// PRICING_REQUIRES_STOCK rule by asking for no pricing here either).
export function inlineCreateProductSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().min(1, t("common.validation.required")),
    newFamilyName: z.string().min(1, t("common.validation.required")),
    newBrandName: z.string().min(1, t("common.validation.required")),
    initialQuantity: z.literal(0),
  });
}

export type InlineCreateProductFormValues = z.infer<ReturnType<typeof inlineCreateProductSchema>>;

type AssertAssignable<T extends true> = T;
type _CreateProductCommandCheck = AssertAssignable<
  InlineCreateProductFormValues extends CreateProductCommand ? true : false
>;

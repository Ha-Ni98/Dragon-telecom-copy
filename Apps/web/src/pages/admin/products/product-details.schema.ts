import { z } from "zod";
import type { UpdateProductCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to UpdateProductCommand (catalog.command.ts) — product-core fields only; the
// contract deliberately keeps taxonomy/quantity/avgStockPrice/avgPrice out of this command
// (catalog spec Business Logic #6), so the ADM-04 details card only edits what's here. `isPublished`/
// `isEnabled` are the list-page toggles, not this form, but stay optional-passthrough in case
// the edit-mode Save patches them together.
export function productDetailsSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    barcode: z.string().optional(),
    name: z.string().min(1, t("admin.productInfo.details.nameRequired")).optional(),
    description: z.string().optional(),
    reorderThreshold: z.number().int().min(0).optional(),
    isPublished: z.boolean().optional(),
    isEnabled: z.boolean().optional(),
  });
}

export type ProductDetailsFormValues = z.infer<ReturnType<typeof productDetailsSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _UpdateProductCommandCheck = AssertAssignable<
  ProductDetailsFormValues extends UpdateProductCommand ? true : false
>;

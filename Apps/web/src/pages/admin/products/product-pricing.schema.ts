import { z } from "zod";
import type { UpdatePricingCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

const CategoryPriceInputSchema = z.object({
  categoryId: z.uuid(),
  price: z.number().min(0),
});

// Aligned to UpdatePricingCommand (catalog.command.ts) — ADM-04's pricing card edit form
// (guestPrice + defaultSalePrice + the 3 category prices, each showing a live margin % vs
// avg cost — read from AdminProductDto.categoryPrices once A1 lands). `guestPrice` stays
// nullable per the contract (empty ⇒ hidden from guests, ADM-03 §UI note applies here too).
export function productPricingSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    guestPrice: z
      .number()
      .min(0, t("admin.productInfo.pricing.guestPriceInvalid"))
      .nullable()
      .optional(),
    defaultSalePrice: z
      .number()
      .min(0, t("admin.productInfo.pricing.defaultSalePriceInvalid"))
      .optional(),
    categoryPrices: z.array(CategoryPriceInputSchema).optional(),
  });
}

export type ProductPricingFormValues = z.infer<ReturnType<typeof productPricingSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _UpdatePricingCommandCheck = AssertAssignable<
  ProductPricingFormValues extends UpdatePricingCommand ? true : false
>;

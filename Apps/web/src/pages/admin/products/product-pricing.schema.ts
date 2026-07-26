import { z } from "zod";
import type { UpdatePricingCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

const CategoryPriceInputSchema = z.object({
  categoryId: z.uuid(),
  price: z.number().min(0),
});

// Loose input (price optional, seeded blank for a category with no stored price yet — S3 R2)
// filtered+narrowed to the strict shape on parse. Deliberately `.array().transform()`, not
// `.preprocess()`: preprocess types its input as `unknown`, which breaks zodResolver's input-type
// inference against `useForm<T>` (see supplier.schema.ts's optionalEmail comment for the same
// gotcha) — `.transform()` keeps the pre-parse input type as this loose shape instead.
const CategoryPriceRowInputSchema = z.object({
  categoryId: z.uuid(),
  price: z.number().min(0).optional(),
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
    // A category with no stored price yet (S3 R2) or one the admin cleared arrives with
    // `price: undefined` — dropped rather than failing the form. Omitting a row from the command
    // means "leave the stored price untouched", matching applyPricing's upsert-what-you-send
    // behavior. Clearing a category price back to "no price" is therefore not expressible through
    // this form; the backend has no delete path for a ProductPrice row either.
    categoryPrices: z
      .array(CategoryPriceRowInputSchema)
      .transform((rows) =>
        rows.filter((row): row is z.infer<typeof CategoryPriceInputSchema> => row.price != null),
      )
      .optional(),
  });
}

export type ProductPricingFormValues = z.infer<ReturnType<typeof productPricingSchema>>;
// `categoryPrices`'s `.transform()` makes the schema's input shape (what the form
// fields/defaultValues/reset use) differ from its output shape (what the valid `handleSubmit`
// callback receives) — RHF needs both, via useForm's 3-generic form:
// useForm<ProductPricingInput, unknown, ProductPricingFormValues>() (same reasoning as
// register.schema.ts's RegisterInput).
export type ProductPricingInput = z.input<ReturnType<typeof productPricingSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _UpdatePricingCommandCheck = AssertAssignable<
  ProductPricingFormValues extends UpdatePricingCommand ? true : false
>;

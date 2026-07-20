import { z } from "zod";
import type { CreateProductCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

const CategoryPriceInputSchema = z.object({
  categoryId: z.uuid(),
  price: z.number().min(0),
});

// Aligned to CreateProductSchema (catalog.command.ts) — that schema already carries every
// refine ADM-03 needs (family/brand XOR, initialUnitCost required iff qty>0, pricing
// forbidden iff qty=0 / PRICING_REQUIRES_STOCK); this wrapper reproduces them with translated
// messages so the multi-card form (ADM-03 §UI) shows errors before the round-trip.
export function productsAddSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .object({
      barcode: z.string().optional(),
      name: z.string().min(1, t("admin.productsAdd.nameRequired")),
      description: z.string().optional(),
      familyId: z.uuid().optional(),
      newFamilyName: z.string().optional(),
      brandId: z.uuid().optional(),
      newBrandName: z.string().optional(),
      modelId: z.uuid().optional(),
      newModelName: z.string().optional(),
      initialQuantity: z.number().int().min(0, t("admin.productsAdd.initialQuantityInvalid")),
      initialUnitCost: z.number().min(0, t("admin.productsAdd.initialUnitCostInvalid")).optional(),
      guestPrice: z.number().min(0, t("admin.productsAdd.guestPriceInvalid")).optional(),
      defaultSalePrice: z
        .number()
        .min(0, t("admin.productsAdd.defaultSalePriceInvalid"))
        .optional(),
      categoryPrices: z.array(CategoryPriceInputSchema).optional(),
      reorderThreshold: z.number().int().min(0).optional(),
    })
    .refine((d) => (d.familyId === undefined) !== (d.newFamilyName === undefined), {
      message: t("admin.productsAdd.familyRequired"),
      path: ["familyId"],
    })
    .refine((d) => (d.brandId === undefined) !== (d.newBrandName === undefined), {
      message: t("admin.productsAdd.brandRequired"),
      path: ["brandId"],
    })
    .refine((d) => !(d.modelId !== undefined && d.newModelName !== undefined), {
      message: t("admin.productsAdd.modelExclusive"),
      path: ["modelId"],
    })
    .refine((d) => d.initialQuantity === 0 || d.initialUnitCost !== undefined, {
      message: t("admin.productsAdd.initialUnitCostRequired"),
      path: ["initialUnitCost"],
    })
    .refine(
      (d) =>
        d.initialQuantity > 0 ||
        (d.guestPrice === undefined &&
          d.defaultSalePrice === undefined &&
          d.categoryPrices === undefined),
      {
        message: t("admin.productsAdd.pricingRequiresStock"),
        path: ["initialQuantity"],
      },
    );
}

export type ProductsAddFormValues = z.infer<ReturnType<typeof productsAddSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _CreateProductCommandCheck = AssertAssignable<
  ProductsAddFormValues extends CreateProductCommand ? true : false
>;

import { useFieldArray } from "react-hook-form";
import type { UseFormRegister, UseFormWatch, FieldErrors, Control } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/useTranslation";
import { useCatalogClientCategories } from "@/hooks/useClientCategories";
import { formatDZD } from "@/lib/utils";
import { MarginDisplay } from "@/components/shared/MarginDisplay";
import type { AdminProductDto } from "@dragon-telecom/contract";
import type { ProductPricingInput } from "@/pages/admin/products/product-pricing.schema";

// `valueAsNumber: true` maps an *empty* input to NaN, not undefined — and `z.number()` rejects
// NaN, so the whole form failed validation and `handleSubmit` never fired: clearing the guest
// price silently saved nothing (S3 finding F1). Same trap, same fix as AdminProductsAdd.tsx.
// guestPrice maps blank to `null` (the contract's explicit "clear it" value — applyPricing
// distinguishes null from undefined); the others map blank to `undefined` = "leave untouched".
const clearableNumber = (raw: string) => (raw === "" ? null : Number(raw));
const optionalNumber = (raw: string) => (raw === "" ? undefined : Number(raw));

interface ProductPricingSectionProps {
  product: AdminProductDto;
  isEditMode: boolean;
  register: UseFormRegister<ProductPricingInput>;
  control: Control<ProductPricingInput>;
  errors: FieldErrors<ProductPricingInput>;
  watch: UseFormWatch<ProductPricingInput>;
}

// Set-03 Sprint 5 rewire — dumb, form-bound to the page's shared pricingForm (use-edit-mode.ts).
// `categoryPrices` is a real field array (useFieldArray), one row per client category (S3 R2) —
// not per existing `AdminProductDto.categoryPrices` row, so a product with no priced category yet
// still gets an (empty) input for each one. The category *name* therefore has to be resolved from
// the live category list, not from `product.categoryPrices` (which a still-unpriced category has
// no entry in). Margins (RC-2) are rendered in both view and edit mode, always against
// `avgStockPrice` (D10); in edit mode they read the live `watch()` value so they recompute on
// every keystroke instead of staying pinned to the saved DTO.
export function ProductPricingSection({
  product,
  isEditMode,
  register,
  control,
  errors,
  watch,
}: ProductPricingSectionProps) {
  const { t, language } = useTranslation();
  const { data: categories } = useCatalogClientCategories();
  const { fields } = useFieldArray({ control, name: "categoryPrices" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.productInfo.card.pricing")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="pricing-guest">{t("admin.productsAdd.guestPriceLabel")}</Label>
          {isEditMode ? (
            <>
              <Input
                id="pricing-guest"
                type="number"
                step="0.01"
                {...register("guestPrice", { setValueAs: clearableNumber })}
              />
              {errors.guestPrice && (
                <p className="text-sm text-destructive">{errors.guestPrice.message}</p>
              )}
            </>
          ) : (
            <p className="text-sm">
              {product.guestPrice != null ? formatDZD(product.guestPrice, language) : "—"}
            </p>
          )}
          <MarginDisplay
            price={isEditMode ? watch("guestPrice") : product.guestPrice}
            cost={product.avgStockPrice}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="pricing-default">{t("admin.productsAdd.defaultSalePriceLabel")}</Label>
          {isEditMode ? (
            <>
              <Input
                id="pricing-default"
                type="number"
                step="0.01"
                {...register("defaultSalePrice", { setValueAs: optionalNumber })}
              />
              {errors.defaultSalePrice && (
                <p className="text-sm text-destructive">{errors.defaultSalePrice.message}</p>
              )}
            </>
          ) : (
            <p className="text-sm">
              {product.defaultSalePrice != null
                ? formatDZD(product.defaultSalePrice, language)
                : "—"}
            </p>
          )}
          <MarginDisplay
            price={isEditMode ? watch("defaultSalePrice") : product.defaultSalePrice}
            cost={product.avgStockPrice}
          />
        </div>

        {fields.map((field, index) => {
          const categoryName = categories?.find((c) => c.id === field.categoryId)?.name ?? "";
          const storedPrice = product.categoryPrices.find(
            (c) => c.categoryId === field.categoryId,
          )?.price;
          return (
            <div key={field.id} className="space-y-1">
              <Label htmlFor={`pricing-category-${index}`}>{categoryName}</Label>
              {isEditMode ? (
                <Input
                  id={`pricing-category-${index}`}
                  type="number"
                  step="0.01"
                  {...register(`categoryPrices.${index}.price`, { setValueAs: optionalNumber })}
                />
              ) : (
                <p className="text-sm">
                  {storedPrice != null ? formatDZD(storedPrice, language) : "—"}
                </p>
              )}
              <MarginDisplay
                price={isEditMode ? watch(`categoryPrices.${index}.price`) : storedPrice}
                cost={product.avgStockPrice}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

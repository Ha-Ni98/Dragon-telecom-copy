import { useFieldArray } from "react-hook-form";
import type { UseFormRegister, UseFormWatch, FieldErrors, Control } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import { MarginDisplay } from "@/components/shared/MarginDisplay";
import type { AdminProductDto } from "@dragon-telecom/contract";
import type { ProductPricingFormValues } from "@/pages/admin/products/product-pricing.schema";

interface ProductPricingSectionProps {
  product: AdminProductDto;
  isEditMode: boolean;
  register: UseFormRegister<ProductPricingFormValues>;
  control: Control<ProductPricingFormValues>;
  errors: FieldErrors<ProductPricingFormValues>;
  watch: UseFormWatch<ProductPricingFormValues>;
}

// Set-03 Sprint 5 rewire — dumb, form-bound to the page's shared pricingForm (use-edit-mode.ts).
// `categoryPrices` is a real field array (useFieldArray) seeded 1:1 from
// AdminProductDto.categoryPrices (A1) — the whole point of that contract change was so this
// card could read/prefill these instead of just guestPrice+defaultSalePrice. Margins (RC-2) are
// rendered in both view and edit mode, always against `avgStockPrice` (D10); in edit mode they
// read the live `watch()` value so they recompute on every keystroke instead of staying pinned
// to the saved DTO.
export function ProductPricingSection({
  product,
  isEditMode,
  register,
  control,
  errors,
  watch,
}: ProductPricingSectionProps) {
  const { t, language } = useTranslation();
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
                {...register("guestPrice", { valueAsNumber: true })}
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
                {...register("defaultSalePrice", { valueAsNumber: true })}
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
          const category = product.categoryPrices.find((c) => c.categoryId === field.categoryId);
          return (
            <div key={field.id} className="space-y-1">
              <Label htmlFor={`pricing-category-${index}`}>{category?.categoryName}</Label>
              {isEditMode ? (
                <Input
                  id={`pricing-category-${index}`}
                  type="number"
                  step="0.01"
                  {...register(`categoryPrices.${index}.price`, { valueAsNumber: true })}
                />
              ) : (
                <p className="text-sm">{category ? formatDZD(category.price, language) : "—"}</p>
              )}
              <MarginDisplay
                price={isEditMode ? watch(`categoryPrices.${index}.price`) : category?.price}
                cost={product.avgStockPrice}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

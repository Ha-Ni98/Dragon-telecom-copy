import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/useTranslation";
import type { AdminProductDto } from "@dragon-telecom/contract";
import type { ProductDetailsFormValues } from "@/pages/admin/products/product-details.schema";

// `valueAsNumber: true` maps an *empty* input to NaN, not undefined — and `z.number()` rejects
// NaN, so the whole form failed validation and `handleSubmit` never fired: clearing the reorder
// threshold silently saved nothing (S3 finding F1, second site). Same trap, same fix as
// AdminProductsAdd.tsx / enhanced-pricing-section.tsx.
const optionalNumber = (raw: string) => (raw === "" ? undefined : Number(raw));

interface ProductDetailsSectionProps {
  product: AdminProductDto;
  isEditMode: boolean;
  register: UseFormRegister<ProductDetailsFormValues>;
  errors: FieldErrors<ProductDetailsFormValues>;
}

// Set-03 Sprint 5 rewire — dumb, form-bound to the page's shared detailsForm (use-edit-mode.ts)
// rather than owning its own RHF instance, since Save spans every card in one click. Taxonomy
// is read-only display here — UpdateProductCommand deliberately excludes it (catalog spec
// Business Logic #6), so there's no field to edit.
export function ProductDetailsSection({
  product,
  isEditMode,
  register,
  errors,
}: ProductDetailsSectionProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.productInfo.card.details")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="details-name">{t("admin.productsAdd.nameLabel")}</Label>
          {isEditMode ? (
            <>
              <Input id="details-name" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </>
          ) : (
            <p className="text-sm">{product.name}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="details-barcode">{t("admin.productsAdd.barcodeLabel")}</Label>
          {isEditMode ? (
            <Input id="details-barcode" {...register("barcode")} />
          ) : (
            <p className="text-sm">{product.barcode ?? "—"}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label>{t("admin.productsList.table.taxonomy")}</Label>
          <p className="text-sm text-muted-foreground">
            {[product.family.name, product.brand.name, product.model?.name]
              .filter(Boolean)
              .join(" / ")}
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="details-description">{t("admin.productsAdd.descriptionLabel")}</Label>
          {isEditMode ? (
            <Textarea id="details-description" rows={3} {...register("description")} />
          ) : (
            <p className="text-sm text-muted-foreground">{product.description ?? "—"}</p>
          )}
        </div>

        {isEditMode && (
          <div className="space-y-1">
            <Label htmlFor="details-threshold">
              {t("admin.productsAdd.reorderThresholdLabel")}
            </Label>
            <Input
              id="details-threshold"
              type="number"
              min={0}
              {...register("reorderThreshold", { setValueAs: optionalNumber })}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

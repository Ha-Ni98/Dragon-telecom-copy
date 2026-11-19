import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/useTranslation";
import type { AdminProductDto } from "@dragon-telecom/contract";
import type { ProductDetailsFormValues } from "@/pages/admin/products/product-details.schema";
import { FieldError } from "@/components/shared/FieldError";

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
  /** S19 — owned by use-edit-mode.ts (which holds the form the generated value is written into);
   *  this component only renders the trigger, exactly like it only renders the inputs. */
  onGenerateBarcode: () => void;
  isGeneratingBarcode: boolean;
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
  onGenerateBarcode,
  isGeneratingBarcode,
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
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </>
          ) : (
            <p className="text-sm">{product.name}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="details-barcode">{t("admin.productsAdd.barcodeLabel")}</Label>
          {isEditMode ? (
            <>
              <div className="flex gap-2">
                <Input id="details-barcode" {...register("barcode")} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={onGenerateBarcode}
                  disabled={isGeneratingBarcode}
                >
                  <Wand2 className="mr-1 h-4 w-4" />
                  {t("admin.productsAdd.autoGenerateBarcode")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("admin.productsAdd.barcodeHelper")}
              </p>
              {errors.barcode && <FieldError>{errors.barcode.message}</FieldError>}
            </>
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

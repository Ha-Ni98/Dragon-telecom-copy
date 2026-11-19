import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutocompleteInput, type AutocompleteOption } from "@/components/shared/autocomplete-input";
import { Info, X, Save } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { FieldError } from "@/components/shared/FieldError";

interface FeaturedEntity {
  id: string;
  name: string;
}

interface StorefrontSettingsProps {
  featuredProducts: FeaturedEntity[];
  productOptions: AutocompleteOption[];
  productSearch: string;
  onProductSearchChange: (value: string) => void;
  isProductSearchLoading?: boolean;
  onAddProduct: (productId: string) => void;
  onRemoveProduct: (productId: string) => void;

  featuredFamilies: FeaturedEntity[];
  familyOptions: AutocompleteOption[];
  onAddFamily: (familyId: string) => void;
  onRemoveFamily: (familyId: string) => void;

  isDirty: boolean;
  onSave: () => void;
  isSaving?: boolean;
}

const MAX_FEATURED_FAMILIES = 6;

// S17 rebuild — was a featured-products-only picker over one static 100-row page (real bug: a
// featured product outside that page could show only its raw uuid, and its fake "Save" button
// only fired a toast — every real write happened one PATCH per chip via onAdd/onRemove). Now
// draft state + one real Save, covering both featured products (server-searched, RC-1 label
// display via AutocompleteInput) and featured families (server-side .max(6) mirrored here so the
// picker never lets the user reach the 400). AdminSettings.tsx owns the draft/save logic; this
// component stays dumb.
export function StorefrontSettings({
  featuredProducts,
  productOptions,
  productSearch,
  onProductSearchChange,
  isProductSearchLoading = false,
  onAddProduct,
  onRemoveProduct,
  featuredFamilies,
  familyOptions,
  onAddFamily,
  onRemoveFamily,
  isDirty,
  onSave,
  isSaving = false,
}: StorefrontSettingsProps) {
  const { t } = useTranslation();

  const familyLimitReached = featuredFamilies.length >= MAX_FEATURED_FAMILIES;

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>{t("admin.settings.storefront.deliveryCompaniesNote")}</AlertDescription>
      </Alert>

      <div className="space-y-2">
        <span className="text-sm font-medium">
          {t("admin.settings.storefront.featuredProducts")}
        </span>
        <p className="text-sm text-muted-foreground">
          {t("admin.settings.storefront.featuredProductsHelp")}
        </p>
        <AutocompleteInput
          value=""
          onChange={(value) => {
            if (value) onAddProduct(value);
          }}
          suggestions={productOptions}
          onSearch={onProductSearchChange}
          isLoading={isProductSearchLoading}
          placeholder={t("admin.settings.storefront.searchProductsPlaceholder")}
          emptyMessage={t("common.noResults")}
          inputId="storefront-featured-products"
          disabled={isSaving}
        />
        <div className="flex flex-wrap gap-2">
          {featuredProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("admin.settings.storefront.noProductSelected")}
            </p>
          ) : (
            featuredProducts.map((product) => (
              <Badge key={product.id} variant="secondary" className="gap-1">
                {product.name}
                <button
                  type="button"
                  onClick={() => onRemoveProduct(product.id)}
                  disabled={isSaving}
                  aria-label={t("admin.settings.storefront.removeProduct")}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">
          {t("admin.settings.storefront.featuredFamilies")}
        </span>
        <p className="text-sm text-muted-foreground">
          {t("admin.settings.storefront.featuredFamiliesHelp")}
        </p>
        <AutocompleteInput
          value=""
          onChange={(value) => {
            if (value) onAddFamily(value);
          }}
          suggestions={familyOptions}
          placeholder={t("admin.settings.storefront.searchFamiliesPlaceholder")}
          emptyMessage={t("common.noResults")}
          inputId="storefront-featured-families"
          disabled={isSaving || familyLimitReached}
        />
        {familyLimitReached && (
          <FieldError>{t("admin.settings.storefront.familyLimitReached")}</FieldError>
        )}
        <div className="flex flex-wrap gap-2">
          {featuredFamilies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("admin.settings.storefront.noFamilySelected")}
            </p>
          ) : (
            featuredFamilies.map((family) => (
              <Badge key={family.id} variant="secondary" className="gap-1">
                {family.name}
                <button
                  type="button"
                  onClick={() => onRemoveFamily(family.id)}
                  disabled={isSaving}
                  aria-label={t("admin.settings.storefront.removeFamily")}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={isSaving || !isDirty}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? t("common.saving") : t("common.save")}
        </Button>
        {isDirty && (
          <span className="text-sm text-muted-foreground">
            {t("admin.settings.storefront.unsavedChanges")}
          </span>
        )}
      </div>
    </div>
  );
}

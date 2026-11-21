import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutocompleteInput, type AutocompleteOption } from "@/components/shared/autocomplete-input";
import { Info, X, Save } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

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

  featuredBrands: FeaturedEntity[];
  brandOptions: AutocompleteOption[];
  onAddBrand: (brandId: string) => void;
  onRemoveBrand: (brandId: string) => void;

  navFamilies: FeaturedEntity[];
  navFamilyOptions: AutocompleteOption[];
  onAddNavFamily: (familyId: string) => void;
  onRemoveNavFamily: (familyId: string) => void;

  isDirty: boolean;
  onSave: () => void;
  isSaving?: boolean;
}

// S17 rebuild — was a featured-products-only picker over one static 100-row page (real bug: a
// featured product outside that page could show only its raw uuid, and its fake "Save" button
// only fired a toast — every real write happened one PATCH per chip via onAdd/onRemove). Now
// draft state + one real Save, covering both featured products (server-searched, RC-1 label
// display via AutocompleteInput) and featured families. AdminSettings.tsx owns the draft/save
// logic; this component stays dumb.
// Owner change after S39: the 6-family cap is gone, and two more ordered pickers were added —
// the home page's brands and the desktop header bar's families. Every list is "empty = hidden"
// on the storefront (no fallback), and all four save with the one button.
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
  featuredBrands,
  brandOptions,
  onAddBrand,
  onRemoveBrand,
  navFamilies,
  navFamilyOptions,
  onAddNavFamily,
  onRemoveNavFamily,
  isDirty,
  onSave,
  isSaving = false,
}: StorefrontSettingsProps) {
  const { t } = useTranslation();

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
          disabled={isSaving}
        />
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

      <PickerBlock
        title={t("admin.settings.storefront.featuredBrands")}
        help={t("admin.settings.storefront.featuredBrandsHelp")}
        options={brandOptions}
        onAdd={onAddBrand}
        placeholder={t("admin.settings.storefront.searchBrandsPlaceholder")}
        inputId="storefront-featured-brands"
        selected={featuredBrands}
        emptyText={t("admin.settings.storefront.noBrandSelected")}
        onRemove={onRemoveBrand}
        removeLabel={t("admin.settings.storefront.removeBrand")}
        disabled={isSaving}
      />

      <PickerBlock
        title={t("admin.settings.storefront.navFamilies")}
        help={t("admin.settings.storefront.navFamiliesHelp")}
        options={navFamilyOptions}
        onAdd={onAddNavFamily}
        placeholder={t("admin.settings.storefront.searchFamiliesPlaceholder")}
        inputId="storefront-nav-families"
        selected={navFamilies}
        emptyText={t("admin.settings.storefront.noNavFamilySelected")}
        onRemove={onRemoveNavFamily}
        removeLabel={t("admin.settings.storefront.removeFamily")}
        disabled={isSaving}
      />

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

// One ordered picker: search box + removable chips, in the order picked. Same markup as the
// featured-families block above (kept inline there so this change stays small).
function PickerBlock({
  title,
  help,
  options,
  onAdd,
  placeholder,
  inputId,
  selected,
  emptyText,
  onRemove,
  removeLabel,
  disabled,
}: {
  title: string;
  help: string;
  options: AutocompleteOption[];
  onAdd: (id: string) => void;
  placeholder: string;
  inputId: string;
  selected: FeaturedEntity[];
  emptyText: string;
  onRemove: (id: string) => void;
  removeLabel: string;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{title}</span>
      <p className="text-sm text-muted-foreground">{help}</p>
      <AutocompleteInput
        value=""
        onChange={(value) => {
          if (value) onAdd(value);
        }}
        suggestions={options}
        placeholder={placeholder}
        emptyMessage={t("common.noResults")}
        inputId={inputId}
        disabled={disabled}
      />
      <div className="flex flex-wrap gap-2">
        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          selected.map((entity) => (
            <Badge key={entity.id} variant="secondary" className="gap-1">
              {entity.name}
              <button
                type="button"
                onClick={() => onRemove(entity.id)}
                disabled={disabled}
                aria-label={removeLabel}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
